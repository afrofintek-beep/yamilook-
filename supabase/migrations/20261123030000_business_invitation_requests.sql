create table public.business_invitation_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.mvp_candidates(id) on delete cascade,
  name text not null,
  activity text not null,
  scene text not null,
  start_year integer,
  planned boolean not null,
  language text not null,
  created_at timestamptz not null default now()
);
create unique index business_request_once on public.business_invitation_drafts(candidate_id, lower(name));
alter table public.business_invitation_drafts enable row level security;
revoke all on public.business_invitation_drafts from public, anon, authenticated;
grant select on public.business_invitation_drafts to authenticated;
create policy "Administrators review business requests" on public.business_invitation_drafts
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create function public.request_business_invitation(p_owner text, p_email text, p_name text, p_activity text,
  p_scene text, p_year integer, p_planned boolean, p_language text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  address text := lower(trim(p_email));
  candidate public.mvp_candidates;
begin
  if (length(trim(p_owner)) between 1 and 120 and length(address) <= 254
    and address ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and length(trim(p_name)) between 1 and 160 and length(p_activity) <= 240
    and p_scene in ('luanda','accra','abidjan','cairo','addis','dar','kinshasa','ibadan','harare','durban')
    and p_language in ('pt','en','fr','ar','am','sw','ln','yo','sn','zu')
    and ((p_planned and p_year is null) or (not p_planned and p_year between 1000 and extract(year from current_date))))
    is not true then raise exception 'invalid business invitation request'; end if;

  perform pg_advisory_xact_lock(hashtextextended(address, 0));
  select * into candidate from public.mvp_candidates where lower(trim(email)) = address
    order by created_at limit 1;
  if not found then
    insert into public.mvp_candidates(full_name,email) values(trim(p_owner),address)
      on conflict(email) do nothing returning * into candidate;
    if not found then select * into strict candidate from public.mvp_candidates where email=address; end if;
  end if;
  if candidate.status = 'pending' then
    insert into public.business_invitation_drafts(candidate_id,name,activity,scene,start_year,planned,language)
      values(candidate.id,trim(p_name),trim(p_activity),p_scene,p_year,p_planned,p_language)
      on conflict do nothing;
  end if;
end $$;
revoke all on function public.request_business_invitation(text,text,text,text,text,integer,boolean,text) from public;
grant execute on function public.request_business_invitation(text,text,text,text,text,integer,boolean,text) to anon, authenticated;

create function public.my_business_invitation_drafts()
returns table(name text, activity text, scene text, start_year integer, planned boolean)
language sql stable security definer set search_path = '' as $$
  select d.name,d.activity,d.scene,d.start_year,d.planned
  from auth.users u join public.mvp_candidates c on lower(trim(c.email))=lower(u.email)
  join public.business_invitation_drafts d on d.candidate_id=c.id
  where u.id=auth.uid() and u.email_confirmed_at is not null and c.status='approved'
  order by d.created_at desc
$$;
revoke all on function public.my_business_invitation_drafts() from public, anon;
grant execute on function public.my_business_invitation_drafts() to authenticated;

-- Run after the existing profile creation trigger has validated the candidate code.
create function public.consume_business_candidate_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  supplied text := upper(trim(coalesce(nullif(new.raw_user_meta_data->>'access_code',''),new.raw_user_meta_data->>'ref')));
  candidate public.mvp_candidates;
begin
  select c.* into candidate from public.mvp_candidates c where c.access_code=supplied
    and exists (select 1 from public.business_invitation_drafts d where d.candidate_id=c.id)
    for update;
  if not found then return new; end if;
  if lower(trim(new.email)) is distinct from lower(trim(candidate.email))
    or candidate.status <> 'approved' or candidate.code_used is not false then
    raise exception 'Business invitation unavailable for this account';
  end if;
  update public.mvp_candidates set code_used=true, code_used_by=new.id, code_used_at=now()
    where id=candidate.id;
  return new;
end $$;
revoke all on function public.consume_business_candidate_invitation() from public, anon, authenticated;
create trigger zz_consume_business_candidate after insert on auth.users
for each row execute function public.consume_business_candidate_invitation();
