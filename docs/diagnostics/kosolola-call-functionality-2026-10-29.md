# KOSOLOLA direct-call functionality

Scope: standard in-app voice/video lifecycle on the existing LiveKit engine. This is implementation and automated validation, not proof of production deployment or a live two-device call.

| Function | Result |
| --- | --- |
| Recipient busy | Account locks reject overlapping calls before creating an invitation. Caller hears a short busy tone and sees a busy message. |
| Caller busy elsewhere | Separate server rejection for another active call on the caller account. |
| Ringback | Cancellable outgoing tone while ringing; stops on transition/unmount. |
| Incoming ringtone | Existing ringtone/vibration retained; answered/terminal updates dismiss the invitation. |
| Multiple answering devices | First device claims the invitation before opening media; subsequent answers do not join or end its call. |
| Decline | Distinct outcome/message; both participant rows released. Group decline retains its existing transport. |
| Cancellation during setup | Visible cancel control; late async success cannot navigate back into the cancelled call. |
| No answer | Conditional timeout marks the call missed; a late timer cannot overwrite an ongoing call. |
| Hang up | Hardware stops immediately; server writes duration and releases both participants without overwriting previous terminal outcomes. |
| History/redial | Existing redial retained; direction icons and outcome labels corrected; missed filter excludes declined/outgoing calls. |
| Microphone/camera | Existing controls exercised in tests; camera denial keeps voice available. |
| Screen sharing | Existing browser support retained; participant state updated. |
| Reconnection | Existing recovery and remote-participant grace period retained and tested. |
| Chat during calls | Existing implementation retained. |
| Camera flip, effects, reactions, recording, scheduling | Existing implementation retained; not newly certified by this change. |

Busy applies to calls in the application calls/participants tables. It cannot detect cellular, WhatsApp or unrelated app calls. Speaker/earpiece/Bluetooth routing is subject to OS/browser support. Autoplay restrictions may block tones; visible feedback remains available. Call waiting is not enabled: an occupied recipient stays in their existing call.

Account locks serialize create_call requests. PGlite validates state/authorization transitions but is not a multi-connection production concurrency load test. Existing stale ongoing-call cleanup is unchanged. iPhone background/terminated-app recovery and real bidirectional media still require device testing.

## Validation

- 97 tests across 20 suites passed (transport, tones, ringtone, call components, KOSOLOLA routes/history).
- 29 isolated PostgreSQL checks passed (busy/crossed calls, first-device claim, unauthorized actions, all terminal outcomes, duration, participant release, anonymous access).
- Production build passed.
- Full TypeScript checking has pre-existing base-branch failures. Comparison with a separate a3d27b8 checkout found no new file/error-code diagnostic pairs. This is not a clean full typecheck.

## Release order

1. Apply 20261029224605_direct_call_busy_feedback.sql and verify RPC permissions.
2. Deploy generate-livekit-token with updated call-access.ts to allow the claimed connecting state.
3. Release the frontend. Releasing it before the backend changes would break answering/ending direct calls.
4. Validate three accounts (A↔B then C→B), two devices for B, refusal, setup cancellation, unanswered timeout, permissions, offline/reconnect, both hang-up directions and iPhone background/resume. Confirm existing calls remain undisturbed and audio is bidirectional.

No production migration or deployment was performed when preparing this PR.
