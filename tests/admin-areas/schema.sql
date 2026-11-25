-- Minimal operation fixtures for PostgreSQL permission and transaction regression tests.
create schema private; create schema storage; create schema afroloc_experience_private;
create table afroloc_experience_private.assignments ("address_id" uuid, "creator" uuid, "is_public" boolean, "recipient" uuid, "accepted_at" timestamp with time zone);
create table private.registration_links ("id" uuid, "code" text, "name" text, "created_by" uuid, "max_uses" integer, "uses_count" integer, "status" text, "expires_at" timestamp with time zone, "created_at" timestamp with time zone);
create table public.afroloc_experience_addresses ("id" uuid, "owner_id" uuid, "label" text, "code" text, "province_code" text, "municipality_code" text, "commune_code" text, "neighborhood" text, "latitude" double precision, "longitude" double precision, "status" text, "reviewer_id" uuid, "review_note" text, "created_at" timestamp with time zone, "expires_at" timestamp with time zone);
create table public.afroloc_official_divisions ("code" text, "level" integer, "name" text, "parent_code" text, "synced_at" timestamp with time zone);
create table public.billing_config ("id" integer, "currency" text, "pro_monthly" integer, "pro_annual" integer, "video_enabled" boolean, "max_video_participants" integer, "video_minutes_cap" integer, "updated_at" timestamp with time zone, "updated_by" uuid, "academia_fee_percent" integer, "payout_require_kyc" boolean, "payout_max_per_request" integer, "payout_daily_cap" integer, "payout_monthly_cap" integer, "payout_hold_days" integer);
create table public.contacts ("id" uuid, "user_id" uuid, "contact_user_id" uuid, "nickname" text, "is_favorite" boolean, "is_blocked" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone);
create table public.conversation_participants ("id" uuid, "conversation_id" uuid, "user_id" uuid, "joined_at" timestamp with time zone, "last_read_at" timestamp with time zone, "is_muted" boolean, "is_pinned" boolean, "is_archived" boolean, "role" text, "history_cleared_at" timestamp with time zone);
create table public.creator_applications ("id" uuid, "user_id" uuid, "full_name" text, "reason" text, "document_url" text, "application_type" text, "status" text, "rejection_reason" text, "reviewed_by" uuid, "reviewed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone);
create table public.invitation_permissions ("user_id" uuid, "granted_by" uuid, "granted_at" timestamp with time zone);
create table public.kumbu_ledger ("id" uuid, "user_id" uuid, "amount" integer, "action_type" text, "source" text, "reference_id" uuid, "description" text, "created_at" timestamp with time zone, "balance_after" integer);
create table public.messages ("id" uuid, "conversation_id" uuid, "sender_id" uuid, "content" text, "message_type" text, "media_url" text, "reply_to_id" uuid, "is_edited" boolean, "is_deleted" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "delivered_at" timestamp with time zone, "read_by" jsonb, "duration_seconds" integer, "expires_at" timestamp with time zone, "is_view_once" boolean, "forwarded_from_id" uuid, "forwarded_from_user_id" uuid, "edited_at" timestamp with time zone, "thumbnail_url" text);
create table public.payout_requests ("id" uuid, "user_id" uuid, "amount_kumbu" integer, "amount_local" numeric, "currency" text, "status" text, "rejection_reason" text, "processed_by" uuid, "processed_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone);
create table public.post_comments ("id" uuid, "post_id" uuid, "user_id" uuid, "content" text, "parent_comment_id" uuid, "likes_count" integer, "created_at" timestamp with time zone, "is_hidden" boolean);
create table public.post_likes ("id" uuid, "post_id" uuid, "user_id" uuid, "reaction_type" text, "created_at" timestamp with time zone);
create table public.posts ("id" uuid, "user_id" uuid, "type" text, "content" text, "media_urls" text[], "location" text, "privacy" text, "is_pinned" boolean, "likes_count" integer, "comments_count" integer, "shares_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "banda_id" uuid, "is_hidden" boolean, "hidden_reason" text);
create table public.residence_declarations ("user_id" uuid, "method" text, "country" text, "city" text, "neighborhood" text, "address_code" text, "gps_accuracy_m" double precision, "submitted_at" timestamp with time zone, "province_code" text, "municipality_code" text, "commune_code" text, "address_complement" text, "catalog_version" text, "territorial_check" text);
create table public.status_views ("id" uuid, "status_id" uuid, "viewer_id" uuid, "viewed_at" timestamp with time zone);
create table public.statuses ("id" uuid, "user_id" uuid, "type" text, "content" text, "media_url" text, "background" text, "music_url" text, "music_title" text, "caption" text, "stickers" jsonb, "privacy" text, "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "is_archived" boolean);

create table storage.objects(id uuid, bucket_id text, name text);
alter table creator_applications enable row level security;
alter table payout_requests enable row level security;
alter table storage.objects enable row level security;
alter table residence_declarations enable row level security;
grant select,update on creator_applications,payout_requests to authenticated;
grant select on storage.objects,residence_declarations to authenticated;
create policy "Admins can view all applications" on creator_applications for select to authenticated using(has_role(auth.uid(),'admin'));
create policy "Admins can update applications" on creator_applications for update to authenticated using(has_role(auth.uid(),'admin'));
create policy "Admins can view all payouts" on payout_requests for select to authenticated using(has_role(auth.uid(),'admin'));
create policy "Admins can update payouts" on payout_requests for update to authenticated using(has_role(auth.uid(),'admin'));
create policy "Admins read all creator docs" on storage.objects for select to authenticated using(bucket_id='creator-documents' and has_role(auth.uid(),'admin'));
alter table auth.users add column deleted_at timestamptz, add column banned_until timestamptz;
alter table public.profiles add column kumbu_available integer default 0, add column kumbu_earned integer default 0,
 add column afroloc_certification_status text, add column afroloc_certified_at timestamptz,
 add column afroloc_certified_by uuid, add column updated_at timestamptz, add column referral_code text;
create table public.user_invitations(code text);
create table private.registration_holds(ticket uuid,link_id uuid,expires_at timestamptz);
create table private.registration_link_redemptions(user_id uuid,link_id uuid);
create table private.registration_link_audit(link_id uuid,actor_id uuid,action text);
create function private.registration_remaining(link private.registration_links) returns integer language sql as $$ select link.max_uses-coalesce(link.uses_count,0) $$;
create function public.is_moderator_or_admin(uid uuid) returns boolean language sql as $$select has_role(uid,'admin') or has_role(uid,'moderator')$$;

alter table public.mvp_candidates add column access_code text;

grant usage on schema storage to authenticated;
