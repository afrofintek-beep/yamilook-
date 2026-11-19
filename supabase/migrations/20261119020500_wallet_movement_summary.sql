-- Apply the history limit to complete transactions, not individual funding rows.
do $$
declare definition text; old_query text := 'select * from public.payment_point_entries where user_id=u order by id desc limit 100';
begin
 definition := pg_get_functiondef('payment_point_private.payment_point_action(text,uuid,bigint,text)'::regprocedure);
 if position(old_query in definition)=0 then raise exception 'Unexpected wallet overview definition'; end if;
 definition := replace(definition, old_query,
  'select max(id) as id, operation, reference, sum(amount)::bigint as amount, max(created_at) as created_at from public.payment_point_entries where user_id=u group by journal_id,operation,reference order by max(id) desc limit 100');
 execute definition;
end $$;
