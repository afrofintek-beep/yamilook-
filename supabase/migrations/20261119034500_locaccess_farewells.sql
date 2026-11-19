-- A closed share has an immutable audience, independent of future grants.
create table locaccess_private.farewell_recipients (
  batch_id uuid not null,
  handle uuid not null references locaccess_private.addresses(handle) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary key(batch_id,recipient_id)
);
create index farewell_handle on locaccess_private.farewell_recipients(handle);
revoke all on locaccess_private.farewell_recipients from public, anon, authenticated;

create function public.locaccess_farewell(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy jsonb; address uuid; batch uuid; selected uuid[]; active uuid[]; expected uuid[];
begin
  -- Validates the session and ownership and locks this address until commit.
  policy := locaccess_private.action('owner',p_data);
  address := (policy->>'handle')::uuid;
  if p_action='close' then
    select array_agg(value::uuid order by value::uuid) into expected from jsonb_array_elements_text(p_data->'grants');
    select array_agg((value->>'id')::uuid order by (value->>'id')::uuid) into active from jsonb_array_elements(policy->'grants');
    if active is null or active is distinct from expected then raise exception 'Os acessos mudaram. Actualiza a lista antes de encerrar.'; end if;
    select array_agg(distinct value::uuid) into selected from jsonb_array_elements_text(p_data->'selected');
    if selected is null or not selected <@ active then raise exception 'Selecciona os destinatários da partilha.'; end if;
    batch := gen_random_uuid();
    insert into locaccess_private.farewell_recipients(batch_id,handle,recipient_id)
      select batch,address,recipient_id from locaccess_private.grants where handle=address and id=any(selected);
    perform locaccess_private.action('close',p_data);
  elsif p_action<>'list' or p_action is null then raise exception 'Pedido inválido.';
  end if;
  return jsonb_build_object('batch',batch,'pending',(
    select coalesce(jsonb_agg(jsonb_build_object('batch',f.batch_id,'id',f.recipient_id,'username',p.username,'message',f.message_id,'date',f.created_at) order by f.created_at desc,p.username),'[]'::jsonb)
    from locaccess_private.farewell_recipients f join public.profiles p on p.id=f.recipient_id
    where f.handle=address and not exists(select 1 from public.messages m where m.id=f.message_id and m.sender_id=auth.uid())
  ));
end $$;
revoke all on function public.locaccess_farewell(text,jsonb) from public,anon;
grant execute on function public.locaccess_farewell(text,jsonb) to authenticated;
