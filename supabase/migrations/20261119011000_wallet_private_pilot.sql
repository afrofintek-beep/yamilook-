-- Access is granted to named accounts until the public launch.
create table public.wallet_pilot_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now()
);
alter table public.wallet_pilot_access enable row level security;
revoke all on public.wallet_pilot_access from anon, authenticated;

create function payment_point_private.wallet_access_allowed(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and (public.has_role(p_user,'admin') or exists(select 1 from public.wallet_pilot_access where user_id=p_user));
$$;
revoke all on function payment_point_private.wallet_access_allowed(uuid) from public,anon,authenticated;
create function public.has_wallet_access()
returns boolean language sql stable security definer set search_path='' as $$
 select payment_point_private.wallet_access_allowed(auth.uid());
$$;
revoke all on function public.has_wallet_access() from public;
grant execute on function public.has_wallet_access() to anon,authenticated;

create function public.wallet_pilot_manage(p_action text default 'status',p_identifier text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão necessária' using errcode='42501'; end if;
 if p_action='status' then
  return jsonb_build_object('allowed',public.has_wallet_access(),'admin',public.has_role(auth.uid(),'admin'));
 end if;
 if not public.has_role(auth.uid(),'admin') then raise exception 'Apenas administradores podem gerir acessos' using errcode='42501'; end if;
 if p_action in ('grant','revoke') then
  select p.id into target from public.profiles p join auth.users u on u.id=p.id
   where lower(p.username)=lower(ltrim(trim(p_identifier),'@')) or lower(u.email)=lower(trim(p_identifier)) or p.id::text=trim(p_identifier) limit 1;
  if target is null then raise exception 'Conta não encontrada. Use o nome de utilizador ou email exacto.'; end if;
  if p_action='grant' then
   insert into public.wallet_pilot_access(user_id,granted_by) values(target,auth.uid()) on conflict(user_id) do nothing;
  else
   delete from public.wallet_pilot_access where user_id=target;
  end if;
 elsif p_action<>'list' then raise exception 'Acção inválida';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',p.display_name,'username',p.username,'granted_at',a.granted_at) order by a.granted_at desc),'[]'::jsonb)
 into result from public.wallet_pilot_access a join public.profiles p on p.id=a.user_id;
 return result;
end $$;
revoke all on function public.wallet_pilot_manage(text,text) from public,anon;
grant execute on function public.wallet_pilot_manage(text,text) to authenticated;

-- Preserve existing RPC signatures, grants and behavior after authorization.
do $$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('payment_point_action','kumbu_spend','kumbu_refund','kumbu_topup','request_payout')
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mbegin\M',E'begin\n if not public.has_wallet_access() then raise exception ''Acesso reservado a administradores e convidados até ao lançamento.'' using errcode=''42501''; end if;','i');
  execute definition;
 end loop;
 -- Automatic rewards must not prevent ordinary posting or participation.
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kumbu_award'
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mbegin\M',E'begin\n if not payment_point_private.wallet_access_allowed(p_user_id) then return json_build_object(''success'',false,''error'',''Funcionalidade em acesso reservado''); end if;','i');
  execute definition;
 end loop;
end $$;

-- Restrictive policies supplement, rather than replace, owner/admin policies.
do $$
declare table_name text;
begin
 foreach table_name in array array['payment_point_wallets','payment_point_orders','payment_point_withdrawals','payment_point_entries','kumbu_ledger','kumbu_purchases','payout_requests','creator_applications','creator_verification_docs','weekly_rankings','weekly_ranking_entries','ranking_history'] loop
  if to_regclass('public.'||table_name) is not null then
   execute format('create policy wallet_pilot_gate on public.%I as restrictive for all to authenticated using (public.has_wallet_access()) with check (public.has_wallet_access())',table_name);
  end if;
 end loop;
end $$;

-- Service-role checkout inserts must validate the recipient before calling AppyPay.
create function payment_point_private.guard_pilot_purchase()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not payment_point_private.wallet_access_allowed(new.user_id) then
  raise exception 'Acesso reservado a administradores e convidados até ao lançamento.' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function payment_point_private.guard_pilot_purchase() from public,anon,authenticated;
create trigger wallet_pilot_purchase before insert on public.kumbu_purchases for each row execute function payment_point_private.guard_pilot_purchase();
