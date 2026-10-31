-- Service-only atomic reference changes. Storage originals are never moved here.
create or replace function public.chat_attachment_reference_transition(p_id uuid,p_action text,p_sha256 text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.chat_attachments; r jsonb; target text; expected text; actual text;
 refs jsonb; source_state text; target_state text; n integer:=0;
begin
 if p_action is null or p_action not in ('cutover','rollback') then raise exception 'Invalid transition'; end if;
 select * into a from public.chat_attachments where id=p_id for update;
 if not found or a.legacy_bucket is null or a.legacy_quarantined then raise exception 'Legacy attachment unavailable'; end if;
 if a.legacy_manifest->>'sha256' is distinct from p_sha256 or p_sha256 !~ '^[a-f0-9]{64}$'
  or coalesce((a.legacy_manifest->>'original_retained')::boolean,false) is not true then raise exception 'Verified recovery manifest required'; end if;
 source_state:=case when p_action='cutover' then 'prepared' else 'references_private' end;
 target_state:=case when p_action='cutover' then 'references_private' else 'rolled_back' end;
 -- Retrying a committed request is inert; it must not overwrite newer user edits.
 if a.legacy_manifest->>'state'=target_state then return jsonb_build_object('changed',0,'state',target_state,'already_applied',true); end if;
 if a.legacy_manifest->>'state' is distinct from source_state then raise exception 'Unexpected migration state'; end if;
 refs:=a.legacy_manifest->'references';
 if jsonb_typeof(refs) is distinct from 'array' or jsonb_array_length(refs)=0 or jsonb_array_length(refs)>10000 then raise exception 'Invalid reference manifest'; end if;
 if exists(select 1 from jsonb_array_elements(refs) x group by x->>'table',x->>'id',x->>'column' having count(*)>1) then raise exception 'Duplicate manifest reference'; end if;
 for r in select value from jsonb_array_elements(refs) order by value->>'table',value->>'id',value->>'column' loop
  if not ((r->>'table'='messages' and r->>'column' in ('media_url','thumbnail_url')) or (r->>'table'='scheduled_messages' and r->>'column'='media_url')) or r->>'value' is null then raise exception 'Invalid reference target'; end if;
  expected:=case when p_action='cutover' then r->>'value' else 'chat-attachment://'||a.object_path end;
  target:=case when p_action='cutover' then 'chat-attachment://'||a.object_path else r->>'value' end;
  actual:=null;
  execute format('select %I from public.%I where id=$1 for update',r->>'column',r->>'table') into actual using (r->>'id')::uuid;
  if actual is distinct from expected then raise exception 'Concurrent reference change; no references changed'; end if;
  execute format('update public.%I set %I=$1 where id=$2',r->>'table',r->>'column') using target,(r->>'id')::uuid;
  n:=n+1;
 end loop;
 update public.chat_attachments set legacy_manifest=legacy_manifest||jsonb_build_object('state',target_state,'transition_at',clock_timestamp(),'references_changed',n) where id=a.id;
 return jsonb_build_object('changed',n,'state',target_state,'original_retained',true);
end $$;
revoke all on function public.chat_attachment_reference_transition(uuid,text,text) from public,anon,authenticated;
grant execute on function public.chat_attachment_reference_transition(uuid,text,text) to service_role;

-- Conservative diagnostic inventory: scans all string/array/JSON columns of every
-- public base table, rather than relying on URL column names or API row limits.
-- Counts only; no contents are exposed. Not authorization for Storage quarantine.
create or replace function public.chat_attachment_public_reference_counts(p_tokens text[])
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c record; n bigint; results jsonb:='[]'::jsonb;
begin
 if p_tokens is null or cardinality(p_tokens) not between 1 and 10 or exists(select 1 from unnest(p_tokens) t where length(t)<3 or t is null) then raise exception 'Invalid inventory tokens'; end if;
 for c in select cols.table_name,cols.column_name from information_schema.columns cols
 join pg_catalog.pg_class t on t.relname=cols.table_name join pg_catalog.pg_namespace s on s.oid=t.relnamespace and s.nspname=cols.table_schema
 where cols.table_schema='public' and t.relkind in ('r','p') and cols.table_name not in ('messages','scheduled_messages','chat_attachments')
 and cols.data_type in ('text','character varying','character','ARRAY','json','jsonb') loop
  execute format('select count(*) from public.%I where exists(select 1 from unnest($1::text[]) token where strpos(lower(to_jsonb(%I)::text),lower(token))>0)',c.table_name,c.column_name) into n using p_tokens;
  if n>0 then results:=results||jsonb_build_array(jsonb_build_object('table',c.table_name,'column',c.column_name,'matches',n)); end if;
 end loop;
 return jsonb_build_object('matches',results,'quarantine_authorized',false,'original_must_be_retained',true);
end $$;
revoke all on function public.chat_attachment_public_reference_counts(text[]) from public,anon,authenticated;
grant execute on function public.chat_attachment_public_reference_counts(text[]) to service_role;
notify pgrst,'reload schema';
