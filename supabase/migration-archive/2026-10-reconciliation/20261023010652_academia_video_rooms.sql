-- Reservations are issued/cancelled by the authoritative billing RPCs only.
revoke insert, update, delete on public.academia_reservations from anon, authenticated;

create or replace function public.can_join_academia_room(p_session uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.academia_sessions%rowtype; u uuid := auth.uid();
begin
  if u is null then return jsonb_build_object('allowed',false,'reason','unauthenticated'); end if;
  select * into s from public.academia_sessions where id=p_session;
  if not found then return jsonb_build_object('allowed',false,'reason','not_found'); end if;
  if s.status <> 'live' then return jsonb_build_object('allowed',false,'reason','not_live'); end if;
  if s.mentor_id <> u and not exists (
    select 1 from public.academia_reservations r where r.session_id=s.id and r.user_id=u and r.status='reserved'
    and (coalesce(s.price_coins,0)=0 or exists (
      select 1 from public.kumbu_ledger l where l.user_id=u and l.reference_id=s.id
      and l.source='academia' and l.action_type='spend' and l.amount <= -s.price_coins
    ))
  ) then return jsonb_build_object('allowed',false,'reason','reservation_required'); end if;
  return jsonb_build_object('allowed',true,'is_host',s.mentor_id=u,'room_name','academia-'||s.id);
end;
$$;
revoke all on function public.can_join_academia_room(uuid) from public, anon;
grant execute on function public.can_join_academia_room(uuid) to authenticated;

create or replace function public.academia_set_live(p_session uuid, p_live boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.academia_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode='42501'; end if;
  select * into s from public.academia_sessions where id=p_session for update;
  if not found or s.mentor_id <> auth.uid() then raise exception 'mentor_required' using errcode='42501'; end if;
  if p_live then
    if s.status not in ('scheduled','live') then raise exception 'session_closed'; end if;
    if s.scheduled_at > now()+interval '15 minutes' then raise exception 'too_early'; end if;
    update public.academia_sessions set status='live' where id=s.id;
  elsif s.status='live' then
    update public.academia_sessions set status='ended' where id=s.id;
  elsif s.status not in ('ended','completed','cancelled') then
    raise exception 'not_live';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.academia_set_live(uuid,boolean) from public, anon;
grant execute on function public.academia_set_live(uuid,boolean) to authenticated;
