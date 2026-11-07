-- Minimal contracts for the real PostgreSQL integration harness, not a production schema.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,created_at timestamptz DEFAULT now(),
 last_sign_in_at timestamptz,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean DEFAULT false);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,email text,referral_code text DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
 display_name text,username text,referred_by uuid,is_verified boolean DEFAULT false,last_seen timestamptz);
CREATE TABLE public.user_settings(user_id uuid);
CREATE TABLE public.mvp_candidates(id uuid,access_code text,status text,code_used boolean,full_name text,email text);
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE FUNCTION public.validate_mvp_access_code(text) RETURNS json LANGUAGE sql AS $$ SELECT '{"valid":false}'::json $$;

-- Contract fixture for the initial-100 workflow deployed separately from this repo.
-- Its service-only grants and the two relevant SQL fragments match the inspected function.
CREATE ROLE service_role;
