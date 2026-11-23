create or replace function public.generate_mvp_access_code() returns text
language plpgsql security definer set search_path='' as $$
declare code_value text;
begin
  loop
    code_value := upper(left(replace(gen_random_uuid()::text,'-',''),16));
    exit when not exists(select from public.mvp_candidates where access_code=code_value)
      and not exists(select from public.user_invitations where code=code_value)
      and not exists(select from public.profiles where upper(referral_code)=code_value);
  end loop;
  return code_value;
end $$;

-- Keep approval and delivery behind the application's existing admin session.
-- The HTTP request is synchronous and the outer transaction holds no candidate lock.
create extension if not exists http with schema extensions;
alter function public.approve_mvp_candidate(uuid) rename to record_mvp_candidate_approval;
revoke all on function public.record_mvp_candidate_approval(uuid) from public,anon;
grant execute on function public.record_mvp_candidate_approval(uuid) to authenticated;

create function public.approve_mvp_candidate(p_candidate_id uuid)
returns json language plpgsql security definer set search_path='' as $$
declare
  headers jsonb := current_setting('request.headers',true)::jsonb;
  result extensions.http_response;
begin
  if not coalesce(public.has_role(auth.uid(),'admin'),false) or
      coalesce(headers->>'authorization','') not ilike 'Bearer %' then
    return json_build_object('success',false,'error','Admin session required');
  end if;
  perform set_config('http.curlopt_timeout_ms','12000',true);
  select * into result from extensions.http((
    'POST','https://rfayqekonkovfbkwjjum.supabase.co/functions/v1/send-mvp-candidate-invitation',
    array[extensions.http_header('Authorization',headers->>'authorization')],
    'application/json',jsonb_build_object('candidateId',p_candidate_id,'action','approve')::text
  )::extensions.http_request);
  if result.status = 200 then return result.content::json; end if;
  return json_build_object('success',false,'error','Falha na aprovação ou envio. Verifica o estado e tenta novamente.');
end $$;
revoke all on function public.approve_mvp_candidate(uuid) from public,anon;
grant execute on function public.approve_mvp_candidate(uuid) to authenticated;
