# Hosted reference cutover and reversal — 31 October 2026

Project `rfayqekonkovfbkwjjum`, PR #2. The normal Supabase connector applied
`chat_attachment_reference_cutover` successfully at version `20261031205637`.
The repository filename contains the exact SQL read back from migration history.
No existing user messages are changed by this schema migration.

## Implementation

A service-only RPC locks the registry row, validates the recovery digest/state and
manifest, locks the exact message rows in deterministic order and changes their
references in a single transaction. A missing row, changed reference, invalid
manifest or stale digest aborts the entire transaction. Rollback uses the same
compare-and-set checks and restores the exact original URLs. A retry of a committed
operation is inert and does not overwrite later edits. The manifest is preserved.

The maintenance wrapper downloads and verifies the source, private object and
recovery copy inside the Edge runtime before invoking the RPC. Preparation cannot
overwrite a manifest after cutover; a conditional save also catches a concurrent
transition. Public-reference diagnostics scan every string/array/JSON column in
public base tables server-side, including nested JSON and non-URL-named columns.
The matcher is intentionally conservative. A zero match is NOT permission to move
or delete a source: originals are always retained and public writes remain safe.

## Evidence

42 hosted checks passed using actual Auth, PostgREST and Storage APIs. The adjacent
JSON receipt includes all outcomes. Beyond the prior authorization/object recovery
checks, this run verified:

- Browser users cannot invoke the maintenance RPC.
- A concurrent edit prevents cutover without changing the other message.
- Two normal messages and one scheduled message switch in one operation.
- Public profile media referencing the same synthetic original is detected and
  remains accessible; outsiders still cannot read the new private object.
- Retrying cutover changes nothing.
- Concurrent edits also prevent rollback without partially reverting other rows.
- Rollback restores all three original references exactly and is retryable.
- Synthetic original deletion/restoration still recovers exact bytes.
- An existing MUXI public attachment sample remains accessible.

Local tests: eight PostgreSQL transition/inventory scenarios (nine entries including
parent), six preparation/recovery tests, plus existing reference helpers. The
inventory fixture includes 1,200 rows and ordinary text, array and nested JSON fields.

The validator was replaced with an unconditional 410 handler and JWT gateway checks
re-enabled. Independent cleanup query confirmed zero test users, profiles,
candidates and conversations, zero registry entries and private objects. Baseline
counts remain 60 historical message references, 134 media objects and 3 voice files.
No real historical attachment or message reference was changed.

## Remaining release decisions

The compatible frontend has not been merged/published. Real reference conversion
must follow frontend availability and use the reviewed, short-lived maintenance
capability in bounded batches. Verify each result and retain the recovery manifest.
Missing or changed source objects stop that candidate; do not replace them silently.

Real-original quarantine remains deliberately unavailable. Existing public originals
and historical voice policies continue to expose the legacy privacy risk. Complete
privacy remediation requires a separately reviewed cutover of those old URLs with
write coordination and protection for shared MUXI content. Do not report this
reference-only migration as completed legacy privacy remediation.
