-- The public entry point consumes a server-verified approval in the debit transaction.
create table wallet_security.approvals (
  holder uuid not null, session_id uuid not null, operation jsonb not null,
  expires_at timestamptz not null, primary key(holder, session_id, operation)
);

create function public.wallet_begin(p_purpose text, p_operation jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare holder uuid := auth.uid(); sid uuid := (auth.jwt()->>'session_id')::uuid; ids jsonb; challenge_value text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
begin
  if not coalesce(public.has_wallet_access(),false) or sid is null then raise exception 'Acesso reservado'; end if;
  if p_purpose not in ('register','authorize') then raise exception 'Pedido inválido'; end if;
  select coalesce(jsonb_agg(credential_id),'[]') into ids from wallet_security.credentials
    where holder_id=holder and revoked_at is null;
  if p_purpose='register' and (auth.jwt()->>'aal' is distinct from 'aal2' or ids <> '[]') then
    raise exception 'Para registar a primeira chave, confirme a sessão com o segundo factor da sua conta.';
  end if;
  delete from wallet_security.challenges where holder_id=holder and expires_at<=now();
  insert into wallet_security.challenges(challenge,holder_id,session_id,purpose,operation)
    values(challenge_value,holder,sid,p_purpose,p_operation);
  return jsonb_build_object('challenge',challenge_value,'credentials',ids);
end $$;

-- Only the verifier can read challenges or grant approval after signature verification.
create function public.wallet_verifier_read(p_holder uuid,p_session uuid,p_challenge text,p_id text)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('purpose',c.purpose,'operation',c.operation,'key',encode(k.public_key,'base64'),'counter',k.sign_count)
 from wallet_security.challenges c left join wallet_security.credentials k on
 k.credential_id=p_id and k.holder_id=c.holder_id and k.revoked_at is null
 where c.challenge=p_challenge and c.holder_id=p_holder and c.session_id=p_session and c.expires_at>now()
$$;

create function public.wallet_verifier_finish(p_holder uuid,p_session uuid,p_challenge text,p_purpose text,p_operation jsonb,p_id text,p_key text,p_counter bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_holder::text,0));
  if not wallet_security.consume_challenge(p_challenge,p_holder,p_session,p_purpose,p_operation) then raise exception 'Autorização expirada'; end if;
  if p_purpose='register' then
    if exists(select from wallet_security.credentials where holder_id=p_holder and revoked_at is null) then raise exception 'Já existe uma chave'; end if;
    insert into wallet_security.credentials(credential_id,holder_id,public_key,sign_count)
    values(p_id,p_holder,decode(p_key,'base64'),p_counter);
  elsif p_purpose='authorize' then
    update wallet_security.credentials set sign_count=p_counter where holder_id=p_holder and credential_id=p_id
      and revoked_at is null and ((p_counter=0 and sign_count=0) or p_counter>sign_count);
    if not found then raise exception 'Chave indisponível'; end if;
    delete from wallet_security.approvals where holder=p_holder and expires_at<=now();
    insert into wallet_security.approvals values(p_holder,p_session,p_operation,now()+interval '60 seconds')
      on conflict(holder,session_id,operation) do update set expires_at=excluded.expires_at;
  else raise exception 'Finalidade inválida';
  end if;
end $$;

create table wallet_security.preferences (
 holder uuid primary key references auth.users(id) on delete cascade,
 blocked boolean not null default false,
 per_transfer bigint not null default 100000000 check (per_transfer between 1 and 100000000),
 per_day bigint not null default 100000000 check (per_day between 1 and 100000000)
);
create function public.wallet_preferences(p_blocked boolean default null,p_transfer bigint default null,p_daily bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs wallet_security.preferences; keys jsonb;
begin
 if not coalesce(public.has_wallet_access(),false) then raise exception 'Acesso reservado'; end if;
 insert into wallet_security.preferences(holder) values(auth.uid()) on conflict do nothing;
 select * into strict prefs from wallet_security.preferences where holder=auth.uid() for update;
 if (prefs.blocked and p_blocked=false or p_transfer>prefs.per_transfer or p_daily>prefs.per_day)
    and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'Confirme primeiro a sessão com o segundo factor da sua conta.'; end if;
 update wallet_security.preferences set blocked=coalesce(p_blocked,blocked),per_transfer=coalesce(p_transfer,per_transfer),per_day=coalesce(p_daily,per_day)
 where holder=auth.uid() returning * into prefs;
 select coalesce(jsonb_agg(created_at order by created_at),'[]') into keys from wallet_security.credentials where holder_id=auth.uid() and revoked_at is null;
 return to_jsonb(prefs) || jsonb_build_object('keys',keys);
end $$;
revoke all on function public.wallet_preferences(boolean,bigint,bigint) from public,anon;
grant execute on function public.wallet_preferences(boolean,bigint,bigint) to authenticated;

alter function public.payment_point_action(text,uuid,bigint,text) rename to wallet_action_impl;
alter function public.wallet_action_impl(text,uuid,bigint,text) set schema payment_point_private;
revoke all on function payment_point_private.wallet_action_impl(text,uuid,bigint,text) from public,anon,authenticated;

create function public.payment_point_action(p_action text,p_id uuid default null,p_amount bigint default null,p_text text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op jsonb; cents bigint; destination text; prefs wallet_security.preferences; spent bigint;
begin
  if p_action in ('pay','refund','withdraw') then
    if p_action='withdraw' then cents:=p_amount; destination:=trim(p_text);
    else
      select amount,case when p_action='pay' then seller_id else buyer_id end::text into cents,destination
      from public.payment_point_orders where id=p_id for update;
    end if;
    insert into wallet_security.preferences(holder) values(auth.uid()) on conflict do nothing;
    select * into strict prefs from wallet_security.preferences where holder=auth.uid() for update;
    if prefs.blocked then raise exception 'As saídas de dinheiro estão bloqueadas'; end if;
    select coalesce(sum(-amount),0) into spent from public.payment_point_entries
      where user_id=auth.uid() and amount<0 and operation in ('payment','refund','reserve')
      and created_at >= (date_trunc('day',now() at time zone 'Africa/Luanda') at time zone 'Africa/Luanda');
    if cents>prefs.per_transfer or spent+cents>prefs.per_day then raise exception 'O valor excede o limite definido para a carteira'; end if;
    op:=jsonb_build_object('action',p_action,'id',p_id,'amount',cents,'destination',destination,'currency','AOA');
    delete from wallet_security.approvals where holder=auth.uid() and session_id=(auth.jwt()->>'session_id')::uuid
      and operation=op and expires_at>clock_timestamp();
    if not found then raise exception 'Confirme esta operação com a chave da carteira'; end if;
  end if;
  if p_action='view' then
    op:=payment_point_private.wallet_action_impl(p_action,p_id,p_amount,p_text);
    if (op->>'own')::boolean then
      select buyer_id::text into destination from public.payment_point_orders where id=p_id;
      return op || jsonb_build_object('buyer_id',destination);
    end if;
    return op;
  end if;
  return payment_point_private.wallet_action_impl(p_action,p_id,p_amount,p_text);
end $$;
revoke all on function public.payment_point_action(text,uuid,bigint,text), public.wallet_begin(text,jsonb) from public,anon;
grant execute on function public.payment_point_action(text,uuid,bigint,text), public.wallet_begin(text,jsonb) to authenticated;
revoke all on function public.wallet_verifier_read(uuid,uuid,text,text), public.wallet_verifier_finish(uuid,uuid,text,text,jsonb,text,text,bigint) from public,anon,authenticated;
grant execute on function public.wallet_verifier_read(uuid,uuid,text,text), public.wallet_verifier_finish(uuid,uuid,text,text,jsonb,text,text,bigint) to service_role;
