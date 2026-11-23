# YAMILOOK / KOSOLOLA — Supabase preview migration recovery (2026-10-27)

## Verified root cause

Production has 15 records in `supabase_migrations.schema_migrations`, beginning with
`20261022133534_single_use_invitations`. That migration requires `public.profiles`,
but the empty preview does not yet have this table. The failing preview's PostgreSQL
logs show `42P01: relation "public.profiles" does not exist` while creating
`public.user_invitations` at 2026-10-27 04:41:06 UTC.

The repository instead includes **183 SQL migration files**, beginning with
`20260110013758_08af1c74-443f-4992-a6aa-489a71519a77.sql` which creates
`public.profiles`. The branching service replays its registered history,
not the live production schema. Those histories therefore diverge.

## What was actually verified in a disposable preview

- On `backup-recovery-e2e-20261027`, 183 source SQL files were replayed
  chronologically, interspersed with nine *staging-only* compatibility
  corrections where baseline objects were missing or outdated.
- The replay required corrections for older Rodas columns and view definition,
  `creator_applications`, `profiles.level`, economy/ranking dependencies,
  `payout_requests`, AFROLOC/public-profile fields,
  `profiles.partner_user_id`, and `hidden_messages`.
- The resulting preview had 135 public tables and the real production database
  had 140 at the time of comparison. In the 138 base tables, the five missing
  preview tables were `close_circle`, `kambas`, `palco_participants`,
  `theme_suggestions` and `themes`.
- `account-backups` private bucket, its three RLS policies and
  `my_attributed_storage_usage()` were present.
- The Storage owner isolation tests were run as SQL transactions under
  simulated `authenticated` and `anon` roles, then rolled back.
- Switching the usage RPC from SECURITY DEFINER to SECURITY INVOKER was
  verified in the preview; it still returned owner-attributed bytes and
  excludes unattributed/foreign objects. This removes elevated execution
  privileges for that RPC.
- The preview's *platform status* remained `MIGRATIONS_FAILED`: manual
  migration replay does NOT automatically repair the branch bootstrap
  workflow or reconcile production migration history.
- No real Auth users or active sessions existed in this preview. Thus real
  two-account sign-in, actual Storage API upload/download and cross-device
  recovery have NOT been validated.

## Required permanent remediation (not yet applied to production)

1. Take a verified pre-change schema backup and capture current migration history.
2. Using Supabase CLI and an audited, access-controlled workspace,
   `supabase db pull --linked` to generate a baseline reflecting the
   **actual production schema** (without production user data).
3. Reconcile duplicate/out-of-order historical timestamps and baseline
   dependencies locally. Never mark all repository migration files applied
   based on filename alone.
4. Use `supabase migration fetch`, `supabase migration list`, and
   `supabase migration repair` only after comparing actual database objects
   with the migration scripts. Do not reapply old DDL to the live production
   database. Repairing the migration metadata on main is a separate
   controlled operation requiring verification.
5. Create a **fresh** preview and require platform status indicating successful
   replay, complete schema parity checks, RLS/advisor validation and a
   clean application build.
6. Only then run two fully authenticated accounts through the Storage API,
   encryption/recovery with the correct and incorrect key, and scoped
   restore, before promotion.

## Scope restriction

Do NOT merge preview-only patches into production as a surrogate for a
baseline. The nine compatibility patches are useful diagnostics but are not a
verified canonical production schema. The account-backup usage RPC follow-up
migration is safe only *after* its parent backup migration is installed.

## References
- https://supabase.com/docs/guides/troubleshooting/branch-in-migrations-failed-status
- https://supabase.com/docs/guides/troubleshooting/new-branch-doesnt-copy-database
