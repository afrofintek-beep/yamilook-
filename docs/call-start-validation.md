# KOSOLOLA call initiation validation — 26 October 2026

## Changes

- UI, WebRTC initiation/answer entry points and lifecycle RPC entry reject self/empty/malformed recipients before media access. A public profile existence check precedes outgoing ICE/media acquisition; lookup errors fail closed.
- Permission denial (`NotAllowedError` / `SecurityError`) stops retries. Hardware/constraint failures retain audio fallback. A browser may use NotAllowedError for camera-only refusal: in that case the user can explicitly retry a voice call.
- Participant/call status updates now require a returned row and propagate errors, including RLS-filtered zero-row writes. Acceptance signal failure is surfaced, local media is released, and the receiver attempts to mark the call failed without overwriting terminal statuses.
- Migration `20261026081919_prevent_self_calls.sql` extends self-call rejection to direct writes and prevents self-addressed signals. NOT VALID leaves history untouched while enforcing new/updated rows. It has **not** been applied to production.

## Evidence and limits

Base reviewed: `25fdfec1e3d2965d5d2dc6686a2c1125745870c1`.

- 511 automated tests across 76 files passed, including 24 new regression cases. Command: `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test-placeholder npm test -- --reporter=dot`. Placeholder values allow unrelated suites to initialize their clients; they are not test account credentials.
- Production build passed. TypeScript whole-project checking has baseline failures; compare baseline and changed branch output, rather than equating a Vite build with a clean typecheck.
- Hosted project `rfayqekonkovfbkwjjum`: inspected `create_call`, constraints and policies. The RPC already rejects self-calls. Both voice/video self-call RPC tests passed under `authenticated`, with a synthetic JWT subject and transaction rollback. No test user or call record was retained.
- Direct INSERT/UPDATE self-call and self-signal CHECK tests passed in temporary SQL tables with rollback. These validate the expressions, **not deployment of the migration or full table/RLS integration**.
- WebRTC tests use mocked media, peer connections, RPC responses and signal writes. Successful offer creation proves orchestration only. No actual two-account/device connection, remote audio/video, ICE/TURN traversal or permission prompt was demonstrated.
- Existing dependency installation was reused locally; no lockfile/dependency changes. A clean CI installation is an additional validation boundary.

## Remaining findings

The hosted direct-write policies are broader than the RPC contract: call insertion checks the initiator, and signal insertion checks only the sender. There is no full call-membership/recipient binding in those signal policies. Participant self-insertion is also broad. The new CHECK constraints only address self-targeting, not these wider authorization issues. A separate participant/room authorization review is required before treating signaling as fully hardened.

Other signaling risks observed by code review remain unverified on devices: outgoing ICE write failures are logged but not retried; the asynchronous answer-send result is not checked; a timestamp-only polling cursor with a 100-row limit can skip ties at a page boundary. These findings are not asserted to explain the user's failed call. TURN reachability and actual permissions still require device evidence.

The Supabase security advisor also flags `public_profiles` as a security-definer view. This PR reads only its already-public `id` projection and does not modify its permissions. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

## Required real-device acceptance test

Prerequisite: two explicitly authorized **different Yamilook/KOSOLOLA account IDs**, logged into separate devices. The prior attempt used `@tony_dinguanza` on both; no second account identifier/session was recovered. Never share passwords in chat.

Record app commit/deployment, account IDs (redact in public reports), devices/browsers, time and call ID for each case:

1. Self-target voice/video: clear message, no media prompt, no call record.
2. A to B voice: grant microphone; B receives and accepts; confirm audio in both directions; hang up from each side in separate runs.
3. A to B video and B to A video: grant mic/camera; confirm both remote audio and video, then termination on both devices.
4. Refuse microphone at caller: no call creation or repeated prompt. Refuse at receiver: clear error, local tracks stopped, caller receives terminal state if network is available.
5. Refuse camera: no repeated prompt; explicitly retry voice. Unavailable camera may fall back to audio; confirm the displayed video state.
6. Simulate RPC/signal failure and network interruption: no false connected state, hardware released, retry possible; inspect database status and both UIs.
7. Repeat across Wi-Fi/mobile networks to exercise TURN, and installed iOS PWA/background behavior separately.

Status: **real-device acceptance pending; PR is not proof of bilateral operation**. Apply the reviewed migration before claiming direct-write protection in production. Review existing migration-history discrepancies before deployment; do not mark unrelated versions applied.
