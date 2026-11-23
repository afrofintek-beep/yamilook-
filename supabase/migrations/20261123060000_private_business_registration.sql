create table public.business_registration_access (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.business_registration_access enable row level security;
revoke all on public.business_registration_access from public, anon, authenticated;
grant select, insert, delete on public.business_registration_access to authenticated;
create policy "Admins select business pilot accounts" on public.business_registration_access
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create function public.has_business_registration_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(),'admin') or
    exists(select 1 from public.business_registration_access where user_id=auth.uid()) or
    exists(select 1 from public.mvp_candidates c
      join public.business_invitation_drafts d on d.candidate_id=c.id
      where c.code_used_by=auth.uid() and c.code_used and c.status='approved')
  )
$$;
revoke all on function public.has_business_registration_access() from public;
grant execute on function public.has_business_registration_access() to authenticated;

create policy "Business registration requires pilot access" on public.business_profiles
  as restrictive for insert to authenticated with check (public.has_business_registration_access());

create or replace function public.request_business_invitation(p_owner text, p_email text, p_name text, p_activity text,
  p_scene text, p_year integer, p_planned boolean, p_language text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  address text := lower(trim(p_email));
  candidate public.mvp_candidates;
begin
  if public.has_business_registration_access() is not true then
    raise exception 'Business registration unavailable' using errcode='42501';
  end if;
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
revoke all on function public.request_business_invitation(text,text,text,text,text,integer,boolean,text) from public, anon;
grant execute on function public.request_business_invitation(text,text,text,text,text,integer,boolean,text) to authenticated;

