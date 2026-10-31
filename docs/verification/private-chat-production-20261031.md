# Private chat attachments — production release, 31 October 2026

## Deployment

PR #2 was merged after all five GitHub workflows (including WebKit mobile controls) and Vercel preview builds succeeded. Merge commit: `ac2b49b0a0d31713f851080670e8a38bbbc4b6f8`; production deployment: `dpl_7PEoKvHcBZJKamc6BZvepxus6hck`, READY, aliases include `www.yamilook.com`, `kosolola.com`, `www.kosolola.com`. Both required migrations preceded release. The production JavaScript chunk `assets/chat-media-CCsvpOKf.js` contains the stable private-reference parser and reservation RPC. Public page HTTP 200.

## Bounded historical conversion

The frozen initial plan contained 59 distinct objects and 60 references. Requests process at most three candidates sequentially. Before cutover, the runner verifies original, private copy and recovery copy by SHA-256 and length; anonymous reads of both private copies must fail. Exact-reference compare-and-set changes are atomic per object; readback must confirm `references_private`. No source deletion, move or overwrite exists in the runner.

A cross-conversation guard was added to the deployed batch runner: a source referenced by more than one conversation is left unchanged. The generic maintenance template must not be used for these multi-conversation candidates without equivalent protection or a separately reviewed per-conversation migration design.

Missing objects are not fabricated or replaced. Their legacy references remain unchanged. The checksums and exact prior URLs needed for rollback remain in the service-only registry manifest; this report contains only opaque candidate hashes and aggregate results.

## Validation scope

The preceding hosted rehearsal passed 42 checks, including participant/outsider authorization, exact-byte recovery, concurrent edits, retry safety and atomic reference rollback. During real conversion every successful candidate receives fresh byte-integrity and anonymous-denial checks. An existing MUXI public media sample returned HTTP 200 during conversion. No real participant account was impersonated. A fresh local browser smoke test could not run because the Chromium download failed; the WebKit CI test and live HTTP/asset checks are the frontend evidence.

## Privacy limitation

Original public files and legacy voice access policies are intentionally retained. Stable references now use participant-scoped private storage, but known historical public URLs can remain accessible. This release is not complete remediation of legacy URL exposure. No original should be quarantined until shared MUXI references, recovery and write coordination have been reviewed separately.

## Final results

All 59 frozen candidates were processed exactly once in 20 batches of at most three. 33 objects / 33 message references were converted successfully; 25 missing source objects / 25 references were left unchanged; one object referenced by two conversations / two references was left unchanged for a separately reviewed migration. No candidate failed its conversion.

Independent SQL reconciliation found 33 registry manifests in `references_private`, no invalid manifests, no missing source/private/recovery objects, and no cross-conversation private message references. Private Storage contains 66 objects (33 live copies + 33 recovery copies), with the bucket still private. The original buckets remain at 134 media objects and 3 voice objects. Messages now have 33 private references and 27 unchanged legacy references.

The short-lived batch endpoint was replaced by an unconditional 410 handler, version 3, and JWT gateway validation was re-enabled. No maintenance capability remains active in that endpoint.

For recovery, inspect the retained manifest and original/private/recovery hashes first, then use the reviewed `rollback` wrapper with a newly scoped maintenance capability. The transaction restores only exact unchanged target references; concurrent edits must be resolved individually. Do not delete originals or recovery copies.
