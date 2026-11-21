create table public.post_screenings (
  post_id uuid primary key references public.posts(id) on delete cascade,
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  text_status text not null,
  media_status text not null,
  media_results jsonb not null default '[]',
  decision text,
  reviewer uuid,
  reviewed_at timestamptz
);
alter table public.post_screenings enable row level security;
revoke all on public.post_screenings from public, anon, authenticated;
grant select on public.post_screenings to authenticated;
create policy moderator_read on public.post_screenings for select to authenticated
using (public.is_moderator_or_admin(auth.uid()));

create function public.screen_post_text(body text) returns text language sql immutable
set search_path = '' as $$
 select case when trim(coalesce(body,''))='' then 'absent'
 when lower(body) ~ '\m(caralho|porra|merda|foda(-se)?|foder|fodido|fodida|puta|putas|cabrão|cabrões|fuck|fucking|shit|putain|merde)\M' then 'flagged'
 else 'clear' end
$$;

create function public.queue_post_screening() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
 insert into public.post_screenings(post_id,text_status,media_status)
 values(new.id,public.screen_post_text(new.content),case when coalesce(cardinality(new.media_urls),0)>0 then 'pending' else 'absent' end)
 on conflict(post_id) do update set revision=gen_random_uuid(),created_at=now(),
 text_status=excluded.text_status, media_status=excluded.media_status,media_results='[]',
 decision=null,reviewer=null,reviewed_at=null;
 return new;
end $$;
create trigger screening_on_insert after insert on public.posts for each row execute function public.queue_post_screening();
create trigger screening_on_edit after update of content,media_urls on public.posts for each row
when (old.content is distinct from new.content or old.media_urls is distinct from new.media_urls)
execute function public.queue_post_screening();
insert into public.post_screenings(post_id,created_at,text_status,media_status)
select id,created_at,public.screen_post_text(content),case when coalesce(cardinality(media_urls),0)>0 then 'pending' else 'absent' end from public.posts
on conflict do nothing;

create function public.review_post_screening(p_revision uuid,p_decision text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.is_moderator_or_admin(auth.uid()) is not true then raise exception 'Sem permissão'; end if;
 if p_decision is null or p_decision not in ('confirmed','dismissed') then raise exception 'Decisão inválida'; end if;
 update public.post_screenings set decision=p_decision,reviewer=auth.uid(),reviewed_at=now()
 where revision=p_revision and decision is null and (text_status='flagged' or media_status='flagged');
 if not found then raise exception 'A publicação foi actualizada'; end if;
end $$;
create unique index post_screenings_revision on public.post_screenings(revision);
create function public.record_media_screening(p_revision uuid,p_results jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.is_moderator_or_admin(auth.uid()) is not true then raise exception 'Sem permissão'; end if;
 if jsonb_typeof(p_results) is distinct from 'array' then raise exception 'Resultado inválido'; end if;
 if exists(select from jsonb_array_elements_text(p_results) r where r is null or r not in ('clear','flagged','error')) then raise exception 'Resultado inválido'; end if;
 update public.post_screenings s set media_results=p_results,
 media_status=case when p_results ? 'flagged' then 'flagged' when p_results ? 'error' then 'error' else 'clear' end,
 decision=null,reviewer=null,reviewed_at=null
 from public.posts p where p.id=s.post_id and s.revision=p_revision and s.media_status in ('pending','error')
 and jsonb_array_length(p_results)=cardinality(p.media_urls);
end $$;
revoke all on function public.record_media_screening(uuid,jsonb), public.review_post_screening(uuid,text) from public, anon;
grant execute on function public.record_media_screening(uuid,jsonb), public.review_post_screening(uuid,text) to authenticated;
create function public.screening_media(p_revision uuid) returns text[] language sql stable security definer
set search_path='' as $$
 select p.media_urls from public.posts p join public.post_screenings s on s.post_id=p.id
 where s.revision=p_revision and public.is_moderator_or_admin(auth.uid())
$$;
revoke all on function public.screening_media(uuid) from public,anon;
grant execute on function public.screening_media(uuid) to authenticated;
