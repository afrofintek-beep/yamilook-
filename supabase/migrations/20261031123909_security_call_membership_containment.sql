-- Direct-call membership comes from the authoritative invitation, never from
-- a self-inserted participant record. Group membership remains inviter-owned.
create or replace function public.is_call_participant(p_call_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calls c where c.id=p_call_id and (
      p_user_id in (c.initiator_id,c.caller_id,c.callee_id)
      or (c.is_group_call and exists (
        select 1 from public.call_participants cp where cp.call_id=c.id and cp.user_id=p_user_id
      ))
    )
  );
$$;
revoke all on function public.is_call_participant(uuid,uuid) from public, anon;
grant execute on function public.is_call_participant(uuid,uuid) to authenticated, service_role;

create or replace function public.can_invite_call_participant(p_call_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calls c where c.id=p_call_id
      and c.initiator_id=auth.uid() and c.status in ('initiated','ringing','connecting','ongoing')
      and (c.is_group_call or p_user_id in (c.initiator_id,c.caller_id,c.callee_id))
  );
$$;
revoke all on function public.can_invite_call_participant(uuid,uuid) from public, anon;
grant execute on function public.can_invite_call_participant(uuid,uuid) to authenticated;

-- RESTRICTIVE policies also constrain old permissive policies left by earlier
-- migrations. SECURITY DEFINER admission RPCs continue to insert atomically.
create policy call_participants_invitation_required on public.call_participants
  as restrictive for insert to authenticated
  with check (public.can_invite_call_participant(call_id,user_id));

create policy call_signals_authorized_members on public.call_signals
  as restrictive for insert to authenticated with check (
    from_user_id=(select auth.uid())
    and public.is_call_participant(call_id,from_user_id)
    and public.is_call_participant(call_id,to_user_id)
    and exists(select 1 from public.calls c where c.id=call_id
      and c.status in ('initiated','ringing','connecting','ongoing'))
  );

-- Prevent membership or invitation reassignment through broad UPDATE policies.
create or replace function public.guard_call_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_table_name='calls' then
      if new.id is distinct from old.id or new.initiator_id is distinct from old.initiator_id
        or new.caller_id is distinct from old.caller_id or new.callee_id is distinct from old.callee_id
        or new.is_group_call is distinct from old.is_group_call
        or new.conversation_id is distinct from old.conversation_id then
        raise exception 'call_identity_immutable' using errcode='42501';
      end if;
    elsif tg_table_name='call_participants' then
      if new.id is distinct from old.id or new.call_id is distinct from old.call_id
        or new.user_id is distinct from old.user_id then
        raise exception 'call_membership_immutable' using errcode='42501';
      end if;
      if new.role is distinct from old.role and not public.is_call_initiator(old.call_id,auth.uid()) then
        raise exception 'call_host_required' using errcode='42501';
      end if;
    elsif tg_table_name='call_signals' then
      if new.id is distinct from old.id or new.call_id is distinct from old.call_id
        or new.from_user_id is distinct from old.from_user_id or new.to_user_id is distinct from old.to_user_id
        or new.signal_type is distinct from old.signal_type or new.payload is distinct from old.payload then
        raise exception 'call_signal_immutable' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_call_identity() from public,anon,authenticated;
create trigger guard_call_identity before update on public.calls for each row execute function public.guard_call_identity();
create trigger guard_call_member_identity before update on public.call_participants for each row execute function public.guard_call_identity();
create trigger guard_call_signal_identity before update on public.call_signals for each row execute function public.guard_call_identity();
