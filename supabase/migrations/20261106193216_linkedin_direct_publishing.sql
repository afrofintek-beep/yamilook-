-- Server-only integration. No browser roles can read tokens or upload URLs.
create table public.linkedin_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject text not null,
  display_name text not null,
  token_ciphertext text not null,
  expires_at timestamptz not null
);
create table public.linkedin_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_path text not null,
  expires_at timestamptz not null
);
create table public.linkedin_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  post_fingerprint text not null,
  subject text not null,
  media_type text not null,
  media_urn text not null,
  size bigint not null check (size between 1 and 104857600),
  upload_ciphertext text,
  status text not null default 'uploading' check (status in ('uploading','processing','ready','publishing','published','uncertain','failed')),
  commentary text,
  visibility text check (visibility in ('PUBLIC','CONNECTIONS')),
  linkedin_post_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);
create table public.linkedin_upload_parts (
  draft_id uuid not null references public.linkedin_drafts(id) on delete cascade,
  part integer not null check (part >= 0),
  etag text not null,
  primary key(draft_id, part)
);
create index linkedin_drafts_user_created on public.linkedin_drafts(user_id, created_at);
create index linkedin_oauth_expiry on public.linkedin_oauth_states(expires_at);
alter table public.linkedin_connections enable row level security;
alter table public.linkedin_oauth_states enable row level security;
alter table public.linkedin_drafts enable row level security;
alter table public.linkedin_upload_parts enable row level security;
revoke all on public.linkedin_connections, public.linkedin_oauth_states, public.linkedin_drafts, public.linkedin_upload_parts from public, anon, authenticated;
grant all on public.linkedin_connections, public.linkedin_oauth_states, public.linkedin_drafts, public.linkedin_upload_parts to service_role;
