# KOSOLOLA: microphone setup and failed calls, 30 October 2026

## Evidence

The supplied 102.6-second iPhone recording shows an outgoing call in “A chamar…” before the microphone permission prompt (roughly 85 seconds into the recording), an incoming-call overlay followed by the page error boundary, and a final “Não foi possível estabelecer a chamada.” toast.

Production call records, matched to the recording's Luanda time:

- 00:36:06: video attempt; failed at 00:36:15 with `transport_failed`, no start timestamp.
- 00:36:45 and 00:37:08: two voice attempts recorded as declined.
- 00:38:09: voice attempt; caller token issued at 00:38:10; recipient claim succeeded at 00:38:19; recipient token issued at 00:38:19; recipient persisted failure at 00:38:21, before any start timestamp.

The token endpoint returned success to both parties in the last attempt. This rules out a token endpoint rejection in that attempt, but does not prove a successful LiveKit connection or microphone publication. The old failure reason does not distinguish those stages. Browser render exceptions were only kept in the in-memory client logger, so the exact exception behind the page error cannot be recovered from server records.

## Confirmed setup defect

The previous caller path created the ringing call and notified the recipient before acquiring microphone permission. It then connected the room and only afterwards invoked microphone capture. Thus the other phone could ring while the caller still had a pending or denied permission request.

## Change

Acquire one audio track before creating an outgoing call. Publish that existing track after joining LiveKit instead of requesting another microphone. On incoming calls, claim the call first, then acquire the microphone before requesting a token or connecting the room. This retains the first-device claim guard. Permission denial, cancellation, server denial and unmount all release the prepared track, including late permission grants. Video camera permission retains the existing optional camera path and voice fallback.

Show preparation feedback with a cancel action while answering; ignore late answer completion after cancellation. Persist bounded setup stage and error class in `calls.end_reason`, without tokens, device IDs or raw messages. This allows a subsequent transport failure to distinguish microphone capture, token acquisition, room connection, publication and acceptance.

The browser's initial permission cannot be bypassed. Persistence across launches is controlled by Safari/iOS; this change does not promise permanent permission for installed web apps.

## Limits

The microphone-order defect is confirmed and covered by regression tests. The exact historical transport error and page rendering exception remain unproven. No successful two-device audio/video exchange is claimed by automated tests. New stage diagnostics will identify a repeated setup failure more precisely.

## Validation

107 automated checks passed across 21 suites, including permission denial, late permission after cancellation, single-track publication, answering cancellation and bounded failure diagnostics. Production build passed. The full TypeScript check retains existing errors in unrelated files; none were reported in the changed call sources.
