-- Caller-scoped operations retain RLS and commit each multi-step edit atomically.
create policy "Admins can insert post topics" on public.post_topics for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can delete post topics" on public.post_topics for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can view all live sessions" on public.live_sessions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_topic_action(p_action text, p_id uuid default null, p_ids uuid[] default '{}', p_reason text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare s public.topic_suggestions%rowtype; n integer;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin') then raise exception 'Admin required' using errcode='42501'; end if;
 if p_action='assign' then
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  perform id from public.posts where id=p_id;
  if not found then raise exception 'Post unavailable'; end if;
  if p_ids is null or cardinality(p_ids)>100 then raise exception 'Invalid topics'; end if;
  delete from public.post_topics where post_id=p_id;
  insert into public.post_topics(post_id,topic_id) select p_id,x from (select distinct unnest(p_ids) x) q;
 elsif p_action='reorder' then
  lock table public.discover_topics in share row exclusive mode;
  select count(*) into n from public.discover_topics;
  if p_ids is null or cardinality(p_ids)<>n or (select count(distinct x) from unnest(p_ids) x)<>n
     or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.discover_topics where id=x)) then
   raise exception 'Topics changed; reload and retry';
  end if;
  update public.discover_topics t set display_order=q.ord from unnest(p_ids) with ordinality q(id,ord) where t.id=q.id;
 elsif p_action='delete' then
  perform id from public.discover_topics where id=p_id for update;
  if not found then raise exception 'Topic unavailable'; end if;
  delete from public.post_topics where topic_id=p_id;
  delete from public.discover_topics where id=p_id;
 elsif p_action in ('approve','reject') then
  select * into s from public.topic_suggestions where id=p_id and status='pending' for update;
  if not found then raise exception 'Suggestion already reviewed or unavailable'; end if;
  if p_action='approve' then
   insert into public.discover_topics(name,slug,display_order,post_count,is_trending)
   select s.name,s.slug,coalesce(max(display_order),0)+1,0,false from public.discover_topics;
  end if;
  update public.topic_suggestions set status=case when p_action='approve' then 'approved' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_action='reject' then nullif(trim(p_reason),'') else null end where id=p_id;
 else raise exception 'Unknown action'; end if;
end $$;
revoke all on function public.admin_topic_action(text,uuid,uuid[],text) from public,anon;
grant execute on function public.admin_topic_action(text,uuid,uuid[],text) to authenticated;

create or replace function public.admin_topic_counts()
returns table(topic_id uuid,post_count bigint) language sql stable security invoker set search_path=public as $$
 select t.id,count(pt.id) from public.discover_topics t left join public.post_topics pt on pt.topic_id=t.id
 where public.has_role(auth.uid(),'admin') group by t.id;
$$;
revoke all on function public.admin_topic_counts() from public,anon;
grant execute on function public.admin_topic_counts() to authenticated;
