# Audit follow-up: account security and calls

Verified on 31 October 2026. Base: `ac2b49b` (includes private chat attachment changes).

## Production changes

- Applied `account_session_revocation_realtime` as `20261031214240`. Revocation of another device's Auth session and its owner-only notification are atomic. Existing active-session validation remains in place. No existing sessions were revoked during deployment.
- Applied `account_backups` as `20261031214253`. The bucket is private, restricted to JSON files up to 20 MiB, and owner-folder scoped for insert/read/delete. Overwrite is not permitted. The usage RPC excludes other accounts, unverified ownership, and backup archives.
- Repository migration filenames and reconciliation records now match the applied versions. The unnecessary DROP POLICY statement was omitted when creating the previously absent revocation table.

Production inspection confirmed RLS, Realtime publication membership, owner-only SELECT, no anonymous revocation reads, no authenticated event insertion, three backup policies, and authenticated-only usage RPC access. The existing application can use these backend capabilities without a frontend change.

## Reproducible verification

- `node scripts/test-account-security.mjs`: existing multi-device SQL integration contract plus 12 backup isolation assertions passed in isolated PostgreSQL.
- `npx vitest run src/lib/account-backup.test.ts src/lib/account-sessions.test.ts src/hooks/useLiveKitCall.test.tsx src/lib/direct-call-reconciliation.test.ts`: 38 tests passed.
- `node scripts/test-security-containment.mjs`: 31 assertions passed.
- `node scripts/test-direct-call-lifecycle.mjs`: 29 assertions passed.
- `node scripts/test-reconcile-direct-calls.mjs`: 11 handler assertions passed.

These tests use synthetic accounts and do not create calls, delete sessions, or upload user archives in production. The account backup workflow now runs the database isolation contract on relevant changes.

## Limits and remaining acceptance tests

Local WebKit execution was blocked before opening a page by missing OS libraries; installing them was not permitted by the runtime. Chromium download also failed. The existing GitHub Mobile controls workflow runs WebKit in its supported runner environment. Neither simulated WebKit nor mocked SDK tests establish actual phone audio quality.

The two recent production calls observed were marked ended; that is not evidence of bidirectional media quality. No physical two-device acceptance test was performed.

For the next real-device check, use two consenting test accounts on separate devices:

1. Voice call in both directions: verify both parties hear each other, mute/unmute, and hang up from each side; microphone indicators must switch off.
2. Video call: verify both cameras, camera disable/enable, voice fallback on camera denial, and switching cameras.
3. Brief loss and restoration of Wi-Fi/mobile connectivity: confirm recovery or an explicit failure; never leave a permanent connecting screen.
4. Decline, no answer, busy recipient, simultaneous devices, and cancellation while permissions are pending.
5. Incoming call while the receiving application is backgrounded and the screen is locked; test Android and iPhone separately.
6. Revoke one secondary test-device session and verify that it signs out while the current device remains signed in.
7. Create an encrypted test-account backup, recover it with its saved recovery key on another test device, verify exported content and preferences, then delete the test backup. Media binaries are not included and preference restore is not full message-history restoration.

Record device/OS/browser, network, app version, local time, expected result and actual result. Do not include passwords, recovery keys, raw JWTs or call contents.

Other database advisory debt remains outside this follow-up. Authenticated execution of the usage RPC is intentional and is constrained internally to `auth.uid()`; no claim of a clean global security audit is made.
