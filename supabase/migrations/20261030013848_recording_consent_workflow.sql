-- Atomic, authenticated recording workflow. Requests are created for the server's
-- participant roster, never by impersonating recipients in client-side INSERTs.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

revoke insert, update, delete on public.recording_consents from anon, authenticated;
revoke insert, update, delete on public.call_recordings from anon, authenticated;

create or replace function private.recording_session(
  p_call_id uuid, p_action text default 'state', p_recording_id uuid default null,
  p_consent boolean default null, p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.call_recordings%rowtype;
  call_status text;
  responses jsonb;
  changed integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.call_participants where call_id=p_call_id and user_id=uid) then
    raise exception 'not_a_participant';
  end if;
  -- Serialize request/start/respond against all other recording actions in this call.
  select status into call_status from public.calls where id=p_call_id for update;
  if p_action <> 'state' and p_action not in ('cancel','stop','fail','complete') and
    (call_status <> 'ongoing' or not exists(select 1 from public.call_participants
      where call_id=p_call_id and user_id=uid and status='connected' and left_at is null)) then
    raise exception 'call_not_connected';
  end if;

  -- Expiry and roster changes fail closed. A new participant requires a new request.
  update public.call_recordings cr set status='stopped'
  where cr.call_id=p_call_id and cr.status in ('pending_consent','recording','paused') and (
    call_status <> 'ongoing'
    or (cr.status='pending_consent' and cr.created_at <= now()-interval '60 seconds')
    or exists(select 1 from public.call_participants cp where cp.call_id=p_call_id
      and cp.status='connected' and cp.left_at is null and cp.user_id<>cr.initiated_by
      and not exists(select 1 from public.recording_consents rc where rc.recording_id=cr.id and rc.user_id=cp.user_id))
    or exists(select 1 from public.recording_consents rc where rc.recording_id=cr.id
      and not exists(select 1 from public.call_participants cp where cp.call_id=p_call_id
        and cp.user_id=rc.user_id and cp.status='connected' and cp.left_at is null))
    or not exists(select 1 from public.call_participants cp where cp.call_id=p_call_id
      and cp.user_id=cr.initiated_by and cp.status='connected' and cp.left_at is null)
  );

  if p_action='request' then
    if exists(select 1 from public.call_recordings where call_id=p_call_id
      and status in ('pending_consent','recording','paused','processing')) then
      raise exception 'recording_already_active';
    end if;
    insert into public.call_recordings(call_id,initiated_by,status)
      values(p_call_id,uid,'pending_consent') returning * into r;
    insert into public.recording_consents(recording_id,user_id,consented)
      select r.id,cp.user_id,false from public.call_participants cp
      where cp.call_id=p_call_id and cp.status='connected' and cp.left_at is null and cp.user_id<>uid
      group by cp.user_id;
  else
    select * into r from public.call_recordings where call_id=p_call_id
      and (p_recording_id is null or id=p_recording_id) order by created_at desc limit 1;
    if r.id is null then
      if p_action='state' then return null; end if;
      raise exception 'recording_not_found';
    end if;
    if p_action='respond' then
      if r.status<>'pending_consent' or p_consent is null then raise exception 'request_closed'; end if;
      update public.recording_consents set consented=p_consent,consented_at=now(),
        revoked_at=case when p_consent then null else now() end
        where recording_id=r.id and user_id=uid and revoked_at is null and not consented;
      get diagnostics changed=row_count;
      if changed<>1 then raise exception 'consent_not_pending'; end if;
      if not p_consent then update public.call_recordings set status='stopped' where id=r.id; end if;
    elsif p_action<>'state' then
      if r.initiated_by<>uid then raise exception 'initiator_required'; end if;
      if p_action='start' then
        if r.status<>'pending_consent' then raise exception 'request_closed'; end if;
        if exists(select 1 from public.recording_consents where recording_id=r.id and (not consented or revoked_at is not null)) then
          raise exception 'consent_required';
        end if;
        update public.call_recordings set status='recording' where id=r.id;
      elsif p_action='pause' and r.status='recording' then
        update public.call_recordings set status='paused' where id=r.id;
      elsif p_action='resume' and r.status='paused' then
        update public.call_recordings set status='recording' where id=r.id;
      elsif p_action='stop' and r.status in ('recording','paused') then
        update public.call_recordings set status='processing' where id=r.id;
      elsif p_action in ('cancel','fail') and r.status in ('pending_consent','recording','paused','processing') then
        update public.call_recordings set status=case when p_action='fail' then 'failed' else 'stopped' end where id=r.id;
      elsif p_action='complete' and r.status='processing' then
        if coalesce(p_metadata->>'storage_path','') not in (p_call_id::text||'/'||r.id::text||'.webm',p_call_id::text||'/'||r.id::text||'.mp4')
          or coalesce((p_metadata->>'file_size_bytes')::bigint,0)<=0 then raise exception 'invalid_recording_file'; end if;
        update public.call_recordings set status='completed', completed_at=now(),
          storage_path=p_metadata->>'storage_path',file_size_bytes=(p_metadata->>'file_size_bytes')::bigint,
          duration_seconds=greatest(0,(p_metadata->>'duration_seconds')::integer) where id=r.id;
      elsif p_action not in ('cancel','fail') then
        raise exception 'invalid_transition';
      end if;
    end if;
    select * into r from public.call_recordings where id=r.id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'consented',consented,'revoked_at',revoked_at)), '[]'::jsonb)
    into responses from public.recording_consents where recording_id=r.id;
  -- Only workflow metadata is exposed, not files, IP addresses or user agents.
  return jsonb_build_object('id',r.id,'initiated_by',r.initiated_by,'status',r.status,
    'deadline',r.created_at+interval '60 seconds','consents',responses);
end;
$$;
revoke all on function private.recording_session(uuid,text,uuid,boolean,jsonb) from public,anon;
grant execute on function private.recording_session(uuid,text,uuid,boolean,jsonb) to authenticated;

create or replace function public.recording_session(
  p_call_id uuid, p_action text default 'state', p_recording_id uuid default null,
  p_consent boolean default null, p_metadata jsonb default '{}'::jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select private.recording_session(p_call_id,p_action,p_recording_id,p_consent,p_metadata);
$$;
revoke all on function public.recording_session(uuid,text,uuid,boolean,jsonb) from public,anon;
grant execute on function public.recording_session(uuid,text,uuid,boolean,jsonb) to authenticated;
