create unique index wallet_one_active_key on wallet_security.credentials(holder_id) where revoked_at is null;
create table wallet_security.unlocks (
 holder_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,
 expires_at timestamptz not null,
 primary key(holder_id,session_id)
);
revoke all on wallet_security.unlocks from public, anon, authenticated;

alter function public.payment_point_action(text,uuid,bigint,text) rename to wallet_action_after_unlock;
alter function public.wallet_action_after_unlock(text,uuid,bigint,text) set schema wallet_security;
revoke all on function wallet_security.wallet_action_after_unlock(text,uuid,bigint,text) from public, authenticated, anon;
create function public.payment_point_action(p_action text,p_id uuid default null,p_amount bigint default null,p_text text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists (select 1 from wallet_security.unlocks where holder_id=auth.uid()
   and session_id=(auth.jwt()->>'session_id')::uuid and expires_at>now()) then
   raise exception 'Desbloqueia a CARTEIRA para continuar.' using errcode='42501';
 end if;
 return wallet_security.wallet_action_after_unlock(p_action,p_id,p_amount,p_text);
end;
$$;
revoke all on function public.payment_point_action(text,uuid,bigint,text) from public,anon;
grant execute on function public.payment_point_action(text,uuid,bigint,text) to authenticated;
