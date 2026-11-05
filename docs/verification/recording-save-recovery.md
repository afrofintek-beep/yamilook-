# Call recording save recovery

## Findings (5 November 2026)

The live recording workflow was inspected alongside the current main branch. The observed recording session ended with status `stopped`, no object path, no stored object and no completion timestamp. The logs show successful recording RPC responses, but do not expose enough action-level information to attribute the user's exact sequence conclusively.

Reproduced defects:

- Route teardown stopped the MediaRecorder but discarded its Blob and cancelled the recording session.
- The server changed active recordings to `stopped` after hangup, rejecting a later upload/finalization.
- Failed saves lived only in the mounted hook, so navigation lost the retry/download UI and media.
- The recorder created a fresh AudioContext after asynchronous consent. A suspended context can produce silent audio on gesture-restricted browsers.
- No calls-page recording playback/recovery list existed.

## Change

- Finalize consented recording on call-screen teardown, retaining the same Blob while the asynchronous save continues.
- Store finalized media in account-scoped IndexedDB before upload, with a memory fallback and an explicit non-durable warning if persistent storage fails.
- Retry the specific recording ID after reload; deduplicate concurrent saves; recognize already-completed sessions and acknowledged duplicate objects. Bound upload waiting to two minutes. A timed-out request may still complete, but immutable names and server validation prevent overwrites.
- Permit post-hangup completion only for previously active, consented sessions. Cancelled/refused sessions remain closed; roster changes during a live call still stop recording.
- Verify actual Storage object ownership, exact path and byte size before marking completed. Scope new uploads to the authenticated initiator's processing session.
- Reuse the call's already-unlocked AudioContext without closing it. Voice-only recordings produce audio files instead of a black video track.
- Add **Chamadas → Gravações** for the user's own recordings and local pending copies, with short-lived private playback URLs.

## Validation

55 focused application tests and 40 PostgreSQL workflow/security checks passed. TypeScript and production build passed. Targeted ESLint has no errors and retains one pre-existing cleanup-ref warning. Linux WebKit does not expose MediaRecorder: the actual recording/reload test is explicitly skipped there, while safe refusal without claiming a saved file is tested. Chromium installation was blocked by an unavailable download endpoint; its real-media fixture remains to run in CI. No actual mixed-audio playback is claimed verified yet. Browser fixtures use synthetic local and remote tones, no real user media or production writes. The SQL tests verify completion after hangup, object existence/size, outsider upload refusal, refusal/cancellation, roster changes and retry idempotency.

## Limits and release

The patch does not reconstruct recordings whose media was already discarded. IndexedDB preservation begins after MediaRecorder finalizes; abrupt browser/OS termination before finalization can still lose the active recording. Device storage denial/eviction cannot be guaranteed against. Two real phones must still verify their actual microphone/remote tracks and Safari behavior.

Production database and frontend have not been changed. Automatic approval review rejected the GitHub push because explicit authorization for the external mutation is required. After authorization: push this branch, run recording CI (including browser media tests), apply the reviewed additive migration, merge the verified commit, confirm the Vercel production deployment for www.yamilook.com/kosolola.com, and verify the final storage/playback journey.

The new migration is backward compatible with the prior UI. Reverting the frontend retains already stored recordings; do not delete existing recordings as part of rollback.
