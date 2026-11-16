-- Read-only owner context for the AFROLOC postal card service. Never returns a position.
create or replace function public.my_postal_card_context(p_source text,p_code text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false))
 or not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=uid)
 or not exists(select 1 from public.profiles where id=uid and account_status='active') then
  raise exception 'Sessão indisponível.' using errcode='42501'; end if;
 if p_code is null or length(p_code)>160 then return null; end if;
 if p_source='residence' then
  select jsonb_build_object('owner',uid,'code',p.afroloc_code,'province',r.province_code,'municipality',r.municipality_code)
  into result from public.profiles p left join public.residence_declarations r on r.user_id=p.id
  where p.id=uid and p.afroloc_code=p_code and upper(p.country_code)='AO' and p.afroloc_certification_status<>'rejected';
 elsif p_source ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
  select jsonb_build_object('owner',uid,'code',code,'province',province_code,'municipality',municipality_code)
  into result from public.afroloc_experience_addresses where id=p_source::uuid and owner_id=uid and code=p_code
  and status in ('pending','approved') and expires_at>now();
 end if;
 return result;
end $$;
revoke all on function public.my_postal_card_context(text,text) from public,anon;
grant execute on function public.my_postal_card_context(text,text) to authenticated;
