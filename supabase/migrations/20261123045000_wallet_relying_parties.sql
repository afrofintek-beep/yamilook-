alter table wallet_security.credentials
  add column relying_party text not null default 'yamilook.com'
  check (relying_party in ('yamilook.com','kosolola.com'));

drop function public.wallet_begin(text,jsonb);
create function public.wallet_begin(p_purpose text,p_operation jsonb,p_relying_party text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare holder uuid := auth.uid(); sid uuid := (auth.jwt()->>'session_id')::uuid; ids jsonb; challenge_value text := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
begin
  if not coalesce(public.has_wallet_access(),false) or sid is null then raise exception 'Acesso reservado'; end if;
  if p_purpose not in ('register','authorize') or p_relying_party not in ('yamilook.com','kosolola.com') then raise exception 'Pedido inválido'; end if;
  select coalesce(jsonb_agg(credential_id),'[]') into ids from wallet_security.credentials
    where holder_id=holder and relying_party=p_relying_party and revoked_at is null;
  if p_purpose='register' and (auth.jwt()->>'aal' is distinct from 'aal2' or ids <> '[]') then
    raise exception 'Para registar a primeira chave, confirme a sessão com o segundo factor da sua conta.';
  end if;
  delete from wallet_security.challenges where holder_id=holder and expires_at<=now();
  insert into wallet_security.challenges(challenge,holder_id,session_id,purpose,operation)
    values(challenge_value,holder,sid,p_purpose,p_operation);
  return jsonb_build_object('challenge',challenge_value,'credentials',ids);
end $$;

drop function public.wallet_verifier_finish(uuid,uuid,text,text,jsonb,text,text,bigint);
create function public.wallet_verifier_finish(p_holder uuid,p_session uuid,p_challenge text,p_purpose text,p_operation jsonb,p_id text,p_key text,p_counter bigint,p_relying_party text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_relying_party not in ('yamilook.com','kosolola.com') then raise exception 'Domínio inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_holder::text,0));
  if not wallet_security.consume_challenge(p_challenge,p_holder,p_session,p_purpose,p_operation) then raise exception 'Autorização expirada'; end if;
  if p_purpose='register' then
    if exists(select from wallet_security.credentials where holder_id=p_holder and relying_party=p_relying_party and revoked_at is null) then raise exception 'Já existe uma chave'; end if;
    insert into wallet_security.credentials(credential_id,holder_id,public_key,sign_count,relying_party)
    values(p_id,p_holder,decode(p_key,'base64'),p_counter,p_relying_party);
  elsif p_purpose='authorize' then
    update wallet_security.credentials set sign_count=p_counter where holder_id=p_holder and credential_id=p_id
      and relying_party=p_relying_party and revoked_at is null and ((p_counter=0 and sign_count=0) or p_counter>sign_count);
    if not found then raise exception 'Chave indisponível'; end if;
    delete from wallet_security.approvals where holder=p_holder and expires_at<=now();
    insert into wallet_security.approvals values(p_holder,p_session,p_operation,now()+interval '60 seconds')
      on conflict(holder,session_id,operation) do update set expires_at=excluded.expires_at;
  else raise exception 'Finalidade inválida';
  end if;
end $$;

revoke all on function public.wallet_begin(text,jsonb,text) from public,anon;
grant execute on function public.wallet_begin(text,jsonb,text) to authenticated;
revoke all on function public.wallet_verifier_finish(uuid,uuid,text,text,jsonb,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.wallet_verifier_finish(uuid,uuid,text,text,jsonb,text,text,bigint,text) to service_role;
