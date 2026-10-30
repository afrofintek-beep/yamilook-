# Migration history reconciliation — 2026-10-25

The 13 recorded production migrations have been restored at their actual server versions with the exact stored SQL. Superseded local variants are preserved under `supabase/migration-archive/2026-10-reconciliation`. `remote-history.json` is a read-only snapshot of migration statements, not user data. Run `node scripts/check-migration-history.mjs` to detect drift.

This resolves repository/remote version and SQL mismatches for the recorded migrations. It does **not** invent applied status for the older schema, nor repair production history. The production ledger starts at `20261022133534`, whose SQL references `public.profiles`; a new Supabase branch therefore cannot bootstrap. Older repository SQL alone is not proof of the live schema and must not be bulk marked applied.

Required next step with a scoped CLI/database session:

1. Take a schema-only dump of the live application schemas (public, private and any other application-owned schemas), including grants, policies, triggers and functions. Inspect custom auth/storage objects separately; never dump auth users, passwords, sessions, OTPs or message data. Do not copy secrets from function bodies to Git.
2. Generate a baseline migration in a separate clean staging project using `supabase migration new`. Restore the reviewed dump there. Restore only required public configuration/seed data, with no user records or active production cron jobs.
3. Compare normalized live/staged catalog manifests: columns, enums, constraints, indexes, grants, policies, functions, triggers and required extensions. Test Auth signup/profile creation and account-link tests in that real database.
4. Only after equivalence, plan the production history reconciliation with a recorded before/after ledger. Use CLI migration repair to register the baseline without executing schema DDL on production; keep archived history for traceability. Do not merge an unverified baseline or use an empty placeholder baseline.

No production schema or ledger was mutated during this reconciliation. The available connector does not offer pg_dump/database credentials; a secure authenticated CLI or Dashboard session is required for the schema baseline and secret provisioning.

A second pre-existing blocker is duplicate version `20260707000000` (`credit_purchases` and `creator_badge`). Both are preserved until baseline reconciliation; renaming either as a new migration could replay already-applied DDL. `node scripts/check-migration-history.mjs --strict` exits 2 while baseline/duplicates remain unresolved.
