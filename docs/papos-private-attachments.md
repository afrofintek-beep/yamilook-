# Private chat attachments — staged rollout

## Verified status

Preparation applied as `20261031204722_private_chat_attachments.sql`.
Atomic reference transition/reversal applied as
`20261031205637_chat_attachment_reference_cutover.sql`.
Both succeeded through the normal connector and were independently read back.
The exact stored SQL and actual server versions are preserved in the repository.
The earlier requestState error did not recur; its root cause remains unknown.
Do not replay the superseded timestamps or alter applied SQL.

Hosted Storage authorization, object recovery and reference cutover/reversal passed
with synthetic data (25 checks in the initial run; 42 in the expanded run). See
`docs/verification/private-chat-storage-20261031.md` and
`docs/verification/private-chat-cutover-20261031.md` plus JSON receipts.
Frontend remains unpublished. No real historical message or file was migrated.

## Access model

New chat uploads use a private 100 MB bucket and immutable registry paths, storing
`chat-attachment://` references. Participants obtain five-minute signed URLs after
message visibility checks. Outsiders and anonymous callers cannot download or sign.
Hidden/deleted/expired messages and removed membership deny new access. Already
issued bearer links remain valid until expiry. This is not E2EE or instant revocation.
Recovery objects have no client read policy. Registry/manifests are service-only.

Preparation retains old-client URL writes and historical voice permissions during
transition. Legacy privacy exposure is NOT fully remediated by these migrations.
The public social `media` bucket stays public.

## Controlled maintenance

The endpoint is disabled by placeholders in source. Deploy only with a fresh
high-entropy capability hash and short expiry; disable it immediately after the run.
Never commit capabilities or return private paths/content/credentials in receipts.

- `inventory`: keyset-paginated metadata scan until empty; counts only, no writes.
- `prepare` with one source bucket/path: reserve identity before copying; verify
  source, private and recovery copy using SHA-256 and byte count; preserve exact
  table/id/column/original-value references in the manifest. Originals stay intact.
  Missing/corrupt/changed files fail closed. Conditional save prevents concurrent
  cutover from being overwritten by a preparing worker.
- `cutover` with one registry ID: reverify all three objects, run diagnostic public
  reference inventory, then atomically switch manifest references. A concurrent
  user edit aborts the whole transaction. Use only after compatible frontend release.
- `rollback` with one registry ID: reverify objects and restore exact manifest URLs
  atomically, refusing to overwrite subsequent edits. Retry is inert after success.
  Prepare again after rollback only when a new reviewed attempt is intended.

Public inventory covers string/array/JSON columns of public base tables, independent
of API row caps and column naming. Matches can include conservative false positives.
Zero matches never authorize quarantine. Originals are ALWAYS retained by this
implementation; no Storage move/delete is exposed by the maintenance endpoint.

## Before conversion of real history

1. Publish and verify the compatible frontend. New private uploads and existing
   public/voice URLs must remain readable to authorized users during transition.
2. Inventory and prepare in bounded batches; report missing files explicitly.
   Reverify copies immediately before reference transitions and retain manifests.
3. Run reference transitions with compare-and-set checks. Stop on conflicts and
   investigate rather than overwriting newer user edits.
4. Verify participant/outsider/anonymous access and public MUXI samples; reconcile
   prepared/converted/rolled-back counts. Disable maintenance after the run.
5. A separate reviewed design is required before withdrawing public originals or
   broad legacy audio reads. Coordinate concurrent public writes, preserve shared
   MUXI originals and retain tested recovery copies. Never roll back by making the
   private bucket public. Do not claim privacy remediation while old URLs persist.

## Validation limits

Synthetic hosted tests prove the exercised operations, not every historical object.
Signed URL expiry used a shortened two-second link; a separately issued 300-second
link confirmed bearer behavior after removal. Public MUXI validation sampled one
existing object. Full historical quarantine is not implemented or authorized here.
