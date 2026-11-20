create table afroloc_experience_private.assignments (
 address_id uuid primary key references public.afroloc_experience_addresses(id),
 creator uuid not null references auth.users(id),
 is_public boolean not null,
 recipient uuid references auth.users(id),
 accepted_at timestamptz
);

-- Preserve the installed codec and session checks while exempting administrators from quotas.
do $$
declare body text := pg_get_functiondef('afroloc_experience_private.handle(text,jsonb)'::regprocedure);
 needle constant text := 'if (select count(*) from public.afroloc_experience_addresses where owner_id=uid and ';
begin
 if array_length(string_to_array(body,needle),1) <> 3 then raise exception 'Unexpected address quota definition'; end if;
 body := replace(body,'or a.owner_id=uid then raise exception','or a.owner_id=uid or exists(select 1 from afroloc_experience_private.assignments r where r.address_id=a.id and r.creator=uid) then raise exception');
 execute replace(body,needle,'if not public.has_role(uid,''admin'') and (select count(*) from public.afroloc_experience_addresses where owner_id=uid and ');
end $$;

create function public.afroloc_registry(action text, data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 admin boolean := coalesce(public.has_role(actor,'admin'),false);
 addr uuid := (data->>'id')::uuid;
 target uuid;
 entry afroloc_experience_private.assignments;
 result jsonb;
begin
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=(auth.jwt()->>'session_id')::uuid and u.id=actor and not coalesce(u.is_anonymous,false)) then raise exception 'Sessão necessária'; end if;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'code',a.code,'public',r.is_public,'mine',r.recipient=actor,'accepted',r.accepted_at is not null,'pending',r.recipient is not null and r.accepted_at is null,'recipient',case when admin then p.username end,'status',a.status) order by a.created_at desc),'[]') into result
  from afroloc_experience_private.assignments r join public.afroloc_experience_addresses a on a.id=r.address_id left join public.profiles p on p.id=r.recipient
  where a.status not in ('closed','rejected') and a.expires_at>now() and (admin or r.recipient=actor or r.is_public);
  return jsonb_build_object('admin',admin,'rows',result);
 end if;
 if action='create' and admin then
  perform pg_advisory_xact_lock(hashtextextended(addr::text,1));
  if exists(select 1 from afroloc_experience_private.assignments where address_id=addr and creator=actor) then return '{}'::jsonb; end if;
  if exists(select 1 from public.afroloc_experience_addresses where id=addr) then raise exception 'Pedido indisponível'; end if;
  perform afroloc_experience_private.handle('create',data);
  perform pg_advisory_xact_lock(hashtextextended((select code from public.afroloc_experience_addresses where id=addr),2));
  if exists(select 1 from public.afroloc_experience_addresses a join public.afroloc_experience_addresses b on b.code=a.code and b.id<>a.id where a.id=addr and b.status<>'closed' and b.expires_at>now()) and (data->>'confirmDuplicate') is distinct from 'true' then raise exception 'Possível duplicado. Confirme que se trata de outro endereço.'; end if;
  insert into afroloc_experience_private.assignments values(addr,actor,coalesce((data->>'public')::boolean,false),null,null);
 elsif action in ('assign','accept') then
  select * into entry from afroloc_experience_private.assignments where address_id=addr for update;
  if not found or not exists(select 1 from public.afroloc_experience_addresses where id=addr and status not in ('closed','rejected') and expires_at>now() for update) then raise exception 'Endereço indisponível'; end if;
  if action='assign' and admin and entry.accepted_at is null then
   select id into strict target from public.profiles where lower(username)=lower(trim(leading '@' from trim(data->>'username'))) and upper(trim(country_code))='AO';
   update afroloc_experience_private.assignments set recipient=target where address_id=addr;
  elsif action='accept' and entry.recipient=actor then
   if entry.accepted_at is not null then return '{}'::jsonb; end if;
   update afroloc_experience_private.assignments set accepted_at=now() where address_id=addr;
   update public.afroloc_experience_addresses set owner_id=actor where id=addr;
  else raise exception 'Operação indisponível'; end if;
 else raise exception 'Sem permissão'; end if;
 insert into afroloc_experience_private.audit(actor,action,address_id) values(actor,case when action='assign' then action||':'||target::text else 'registry_'||action end,addr);
 return '{}'::jsonb;
exception when no_data_found then raise exception 'Utilizador de Angola não encontrado';
end $$;
revoke all on function public.afroloc_registry(text,jsonb) from public,anon;
grant execute on function public.afroloc_registry(text,jsonb) to authenticated;
