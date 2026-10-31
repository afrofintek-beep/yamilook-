# Hosted private attachment validation — 31 October 2026

Project: `rfayqekonkovfbkwjjum` (YAMILOOK). PR #2 preparation revision
`a23cfa1b60f064f3dbe268451396b1815094f2a7`.

## Database

The revised `private_chat_attachments` preparation SQL succeeded through the normal
Supabase apply_migration interface. Independent readback confirmed table, private
100 MB bucket, participant Storage policies, retained legacy audio policies and
migration version `20261031204722`. The former repository timestamp was replaced
with this actual version and its exact stored statements; no ledger was fabricated.
The earlier requestState failure did not recur in this attempt. Root cause remains
unknown; no authentication/permission restrictions were weakened to apply SQL.

## Hosted test

25 checks passed through actual Supabase Auth, PostgREST and Storage HTTP APIs.
See the adjacent JSON receipt. Three disposable synthetic users were created using
normal MVP candidate authorization and Auth admin APIs; no invitation gate was
disabled and no email was sent. A dedicated short-lived, random capability protected
the temporary validator. Service credentials remained inside the Edge runtime.

Verified: reservation/upload ownership; pending visibility; participant exact-byte
download; outsider and anonymous denial for downloads and signing; denial through
the public object route; participant signed URLs; signed-URL expiry using a two-second
test link; hidden, expired, deleted and removed-participant denial for new access.
A separately issued 300-second link remained usable after removal, as expected for
a bearer URL. Immediate revocation is not claimed.

Historical preparation was exercised only on a disposable synthetic file in `media`.
Two preparation runs reused the same registry identity and produced verified private
and recovery copies. The original public URL and message reference remained intact.
Recovery objects were inaccessible to member, outsider and anonymous clients.
The synthetic original was then deleted and restored through Storage copy from the
recovery object; the restored bytes and original public URL were verified. No real
historical file was moved, rewritten or downloaded into the developer workspace.
An existing public MUXI post attachment passed an HTTP HEAD accessibility check.
This is a sample check, not exhaustive certification of every public attachment.

## Cleanup

The runtime cleaned its objects, conversation, registry rows, candidates and Auth
users. Independent readback found three residual synthetic profile rows; these and
their settings were subsequently removed using exact test identities. Final readback
confirmed zero synthetic users/profiles/candidates/conversations, zero private objects
and registry entries. The baseline 60 legacy messages, 134 media objects and 3 voice
objects remained. The validator was replaced with an unconditional HTTP 410 handler,
with gateway JWT verification enabled (deployed version 2).

## Scope remaining

Frontend has not been merged or deployed. Existing public/private legacy policies
remain for compatibility; historical privacy remediation is NOT complete. Object
copy/restoration is proven for the synthetic fixture, but transactional historical
message-reference cutover and reversal are not implemented or rehearsed. Complete
public-reference discovery and concurrency controls remain prerequisites to any
quarantine of real originals. Keep recovery data and preserve shared MUXI originals.
