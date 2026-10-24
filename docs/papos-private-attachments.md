# Private chat attachments — rollout

This change is prepared for deployment after `private_chat_attachments` is applied.
It must not be merged to production before the database functions and storage policies
exist. It does not implement E2EE or repair the other audit findings.

## Model

- `chat-attachments` is private with a 100 MB object limit. New images, videos, documents,
  audio and video covers use server-reserved paths and immutable registry entries.
- Messages store `chat-attachment://...` references, never signed bearer URLs. Components
  request five-minute signed URLs through Storage RLS. Links already issued may remain
  usable until their expiry; downloaded copies cannot be revoked.
- Only the uploader can upload the reserved object, while still a conversation member.
  Before sending, only that uploader can read the pending upload for one hour.
- Sent objects require a live, non-deleted/non-expired message visible to the requesting
  participant. Authorized forwarding creates another such reference in its destination.
- Message and scheduled-message triggers prevent claiming someone else's known path.
  Public local media URLs are rejected in new chat attachment writes, including old clients.
- Clients cannot edit the registry or update/move/delete private Storage objects.
- Public Ritmos/feed uploads retain the public `media` bucket. No blanket privacy change
  is made to that bucket. Historical voice uploads are no longer readable account-wide.

## Legacy migration

The temporary maintenance function has disabled placeholders in the repository. Deployment
requires a freshly generated high-entropy bearer capability whose SHA-256 hash and short
expiry are injected into the deployment only. Do not commit tokens or create a permanent
public maintenance endpoint. Replace the function with a disabled handler immediately
after the run; never relax user-facing authorization to invoke maintenance.

The function reads attachment metadata and URL-reference fields only. It copies local
chat files to private storage, rewrites exact message/scheduled-message references and
moves originals to a private recovery location rather than deleting them. Registry legacy
fields support resuming partially completed work. It returns counts, never file paths,
message contents or credentials. Files referenced elsewhere as public content retain their
public original, and this exception must be reported explicitly. Missing source files
are reported rather than fabricated or silently discarded. Previously distributed links
and cached copies cannot be guaranteed to disappear instantly.

The migration must be followed by read-only checks: bucket privacy, object policies,
remaining legacy references, quarantine/shared/missing counts, and unauthenticated
denials for private objects and old quarantined URLs. Verify a public feed sample remains
accessible. Do not download real private attachments to a developer workspace for tests.

## Validation performed before rollout

`tests/security/chat-attachments.test.mjs` exercises real PostgreSQL roles/RLS in isolated
PGlite with synthetic A/B/C users: reservations, upload ownership, pending visibility,
member/external reads, path-claim denial, forwarding, removal/expiry, registry privileges,
anonymous denial and preservation of the public social bucket. It is a minimal schema,
not a full hosted Storage integration or a production penetration test.

Run with the tooling described in `papos-membership-security.md`. Client tests cover private
reference handling, five-minute signing, denials, media rendering and existing chat flows.
The public upload path is intentionally retained for social content. No production
migration or legacy file move should be assumed complete merely because tests pass.
