# Private chat attachments — staged rollout

## Release status

Preparation only. Do not merge/deploy the client until the exact SQL migration is
verified in the target project and hosted Storage authorization tests pass. Do not
claim historical privacy remediation complete after preparation. Existing public
URLs and legacy audio permissions remain until a separately reviewed cutover.
The original all-in-one legacy mover has been removed: its recovery and public
reference inventory were not sufficient for production quarantine.

## Database preparation

`20261024003034_private_chat_attachments.sql` creates the private 100 MB bucket,
registry, reservation RPC, participant read/upload policies and private-reference
validation. It intentionally retains old client URL writes and historical audio
policies during transition. It does not modify existing messages, memberships or
public media objects. The registry is service-only and now includes a recovery
manifest. This migration was confirmed absent in production before revision;
never replay or edit an already-applied version on another environment.

Before applying, verify prerequisite schemas/tables/columns and inspect all
Storage policies for broad permissive rules. Verify migration history and the
actual deployed definitions afterward; reconcile version with the repository
filename using the repository migration-history workflow. Do not mark applied
based only on a tool acknowledgement.

## Private authorization

New messages use stable chat-attachment references and five-minute signed URLs.
Only the reserving participant uploads; existing visible messages authorize
participants to read and forward. Removed participants cannot obtain new links
through that conversation. Previously issued bearer URLs remain usable until
expiry. This is not E2EE or immediate URL revocation.

## Historical preparation (no cutover)

The maintenance endpoint remains disabled by deployment placeholders. When
hosted validation has passed, inject a fresh high-entropy capability hash and
short expiry for a controlled run, then disable the endpoint again.

- `mode: inventory` reads keyset-paginated message metadata until an empty page
  and returns counts only. It performs no writes.
- `mode: prepare`, with one explicit `bucket` and `path`, re-inventories and
  prepares that candidate only. Requests for cutover or other modes fail.
- A unique legacy source registry row is reserved before any copy. Retries reuse
  that identity instead of creating orphan destinations.
- Copy to the private destination and a private recovery location. SHA-256 and
  byte length of both copies must match the source, then re-read the source to
  detect concurrent changes. Verification occurs in the maintenance runtime;
  private contents never go to the developer workspace or response.
- Save the exact message table/id/column/original-value references, checksums,
  length and recovery path in the service-only manifest. A failed manifest write
  can be retried; existing destinations must match and are never overwritten.
- Missing sources and mismatched copies fail closed. Existing quarantine records
  require manual recovery review. No move/delete or message rewrite is available.

Originals are retained, including every public MUXI reference. Preparation does
not make historically public objects private. The public-reference RPC is not
used to authorize deletion: its column-based inventory is insufficient for that.

## Remaining cutover gates

1. Test hosted Storage using synthetic A/B/C users and anonymous requests: upload,
   signing/download, foreign-path claiming, removal, hidden/expired/deleted
   messages, recovery-path denial and signed URL expiry. Check public MUXI samples.
2. Rehearse restoration using synthetic data and the exact per-reference manifest.
   No production history rewrite until this passes.
3. Implement complete paginated public-reference discovery, including supported
   JSON/relative paths; freeze relevant writes or otherwise coordinate concurrent
   public/chat references for the cutover window. Revalidate every candidate.
4. After the compatible frontend is validated, rewrite references transactionally
   with compare-and-set checks against the manifest. Do not overwrite concurrent
   edits. Introduce durable per-object state and reconcile Storage/DB boundaries.
5. Only quarantine verified, unshared originals. Preserve shared public objects
   and report residual exposure explicitly. Replace broad legacy audio reads
   with participant-scoped access before declaring remediation complete.
6. Retain private recovery data through an agreed recovery period; never roll back
   by making the new bucket public. Disable maintenance after the run.

## Authentication incident

Administrative reads work; that does not verify the apply_migration confirmation
continuation. Invalid or expired requestState is a connector/protocol failure,
not evidence of invalid SQL. Do not bypass confirmation or change SQL to evade
it. Obtain a supported connection/continuation repair and inspect verifier logs
through support if needed. No migration retry is justified before technical gates.

## Local verification

Run client tests with Vitest. `chat-legacy-prepare.test.ts` covers interrupted
manifest writes, idempotent retries, corruption, missing and changed sources.
`tests/security/chat-attachments.test.mjs` runs PostgreSQL roles/RLS in PGlite,
including old-client compatibility. These do not replace hosted Storage tests.
