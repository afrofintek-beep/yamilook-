create extension if not exists pg_net with schema extensions;
alter table public.call_recordings alter column retention_days set default 30;
alter table public.call_recordings add column if not exists deletion_requested_at timestamptz;
update public.call_recordings set retention_days=30,expires_at=now()+interval '30 days' where status='completed';
create or replace function private.recording_expiry() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='completed' and (old.status is distinct from 'completed' or new.expires_at is null) then
 new.retention_days:=30; new.expires_at:=now()+interval '30 days';
 end if; return new;
end $$;
create trigger recording_expiry before update on public.call_recordings for each row execute function private.recording_expiry();
create index if not exists recording_expiry_due on public.call_recordings(expires_at) where status='completed';

-- Internal scheduler credential is generated in the database, never returned to clients.
create table private.recording_maintenance_config(singleton boolean primary key default true check(singleton), token text not null);
alter table private.recording_maintenance_config enable row level security;
revoke all on private.recording_maintenance_config from public,anon,authenticated;
insert into private.recording_maintenance_config values(true,gen_random_uuid()::text||gen_random_uuid()::text);
create or replace function public.recording_maintenance_authorized(p_token text) returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from private.recording_maintenance_config where token=p_token);
$$;
revoke all on function public.recording_maintenance_authorized(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.recording_maintenance_config to service_role;
grant execute on function public.recording_maintenance_authorized(text) to service_role;

-- Once requested, completion cannot resurrect a recording during object removal.
create or replace function private.prevent_recording_resurrection() returns trigger language plpgsql set search_path='' as $$
begin
 if old.deletion_requested_at is not null and new.status='completed' then raise exception 'recording_deleted'; end if;
 return new;
end $$;
create trigger prevent_recording_resurrection before update on public.call_recordings for each row execute function private.prevent_recording_resurrection();

create or replace function private.run_recording_maintenance() returns void language plpgsql security definer set search_path='' as $$
begin
 perform net.http_post(url:='https://rfayqekonkovfbkwjjum.supabase.co/functions/v1/recording-retention',
 headers:=jsonb_build_object('Content-Type','application/json','x-retention-token',(select token from private.recording_maintenance_config)),body:='{}'::jsonb);
end $$;
revoke all on function private.run_recording_maintenance() from public,anon,authenticated;
select cron.schedule('recording-retention','*/15 * * * *','select private.run_recording_maintenance()');
