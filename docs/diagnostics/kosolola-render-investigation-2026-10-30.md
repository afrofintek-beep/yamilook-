# KOSOLOLA call rendering investigation — 2026-10-30

## Production evidence
Vercel resolved www.yamilook.com and www.kosolola.com to production deployment
`dpl_q6yAvwNRJkCHyfNQws7GrbBmEH4W`, READY, main commit
`d1300678b01c02a318814d5eb4090a6239465456`. This includes #85 and #86.
This confirms the server deployment, not the cached version on a particular iPhone.
The live call route redirected the investigation browser to /papos-app/login;
no authenticated test accounts or physical iPhone were available in this session.

## Confirmed defect and correction
PaposBoundary renders its fallback before componentDidCatch writes sessionStorage.
The pre element therefore shows an empty or previous diagnostic until a further
render. Opening the native details element does not itself cause a React render.
Three new regression cases failed against main: stale diagnostic, denied storage,
and missing incoming-overlay diagnostic. Both boundaries now keep the current
sanitized diagnostic in component state. Persistence remains best-effort and local.
IncomingCallBoundary additionally exposes the diagnostic alongside answer/decline.
No call transport, message payload, media permission or backend behavior changed.

This is a diagnostic defect, NOT the demonstrated cause of the original iPhone crash.

## Reviewed paths and limits
- PaposCallLayout keeps ActiveCallProvider outside the page boundary. Page retry
  preserves that provider; a full reload restarts the application and cannot be
  treated as proof of uninterrupted media. Provider failures reach the outer boundary.
- IncomingCallBoundary contains render/lifecycle failures of the rich incoming
  overlay; event-handler errors and asynchronous rejections are not caught by a
  React boundary. Answer/decline handlers have their own try/catch.
- ActiveCallProvider uses an answering lock and operation epochs to reject duplicate
  answers and ignore late setup completion after cancellation.
- useCallTransport selects LiveKit/legacy and guards pending operations;
  useLiveKitCall uses generation checks for media/token/connect completion.
- Call, VideoCall, ParticipantGrid and ringtone paths were inspected. Static hook
  checking did not identify a rules-of-hooks violation in the inspected call paths.
  That is not proof against a data-dependent/runtime failure.
- Existing tests mock transport, API responses or child components. They do not
  demonstrate real two-account signaling, audio delivery or iPhone behavior.
- Production React may report minified error codes as generic render-exception;
  preserve the generated asset frame locations even if the category is generic.

## Validation
58 tests passed across 10 targeted files (boundaries, page isolation, provider,
LiveKit, transport selection, ringtone, video controls, chat and diagnostics).
Production build passed. ESLint passed for all four changed TSX files.
Broader call-directory lint still reports a pre-existing explicit-any in the
provider test and five existing dependency/fast-refresh warnings.

## Required device evidence and controlled acceptance
Before starting, update/reload only while no call is active. Record exact domain,
iOS version, Safari versus home-screen app, and local time (Luanda UTC+1).
Use two agreed test accounts on separate devices, both initially in foreground.
1. A calls B by voice. B captures any error before retry/reload, then answers.
2. Check voice in both directions; exchange a test message each way; hang up.
3. Reverse roles: B calls A and repeat.
4. Repeat both directions with video; then separately test receiving from background.
For each failure, expand Diagnóstico técnico and copy/screenshot its entire JSON:
version, time, category, frames and components. Record which side failed, whether
before/after answering, and whether audio continued. Check time is the current
incident, not an earlier record. The original #86 UI can display stale/empty JSON;
the correction in this branch must be deployed for reliable first-failure capture.
Do not close the tab or clear site data before collecting evidence. No passwords,
session tokens, message contents or media recordings are needed.
If frames are empty or cannot identify the fault, a connected Mac Safari Web
Inspector can capture the first exception stack with generated JS file/line/column.
Redact credentials, query strings and personal content before sharing.
