# Recording consent repair

The previous client inserted consent rows for other users and read their replies,
while RLS allowed only own-user inserts and reads. The errors were ignored, leaving
the initiator waiting indefinitely. Incoming requests depended solely on INSERT
notifications and could be lost before the subscription was ready.

The authenticated recording_session RPC now creates requests atomically from the
connected participant roster, records each participant's own answer, and enforces
unanimous consent and a 60-second deadline. Only the initiator can start, pause,
stop or complete a recording. Direct client writes are revoked. The public RPC is
security-invoker; its private implementation checks auth.uid and call membership,
uses an empty search_path and serializes transitions on the call row. Only workflow
metadata is returned; file paths, IP addresses and user agents are not exposed.

The UI retrieves snapshots on mount, every two seconds, on reconnect and on returning
to the foreground. Requests and responses have bounded network waits. A failed answer
remains visible for retry. Dismissal declines/cancels, late answers cannot restart a
closed request, and another device cannot start the same recording twice. Roster
changes terminate the session on the next snapshot. Connection loss stops local
capture when the consent verification request fails. Controls and notices use Portuguese.

The recorder prevents duplicate starts, serializes stops, releases its generated tracks
without stopping the call's microphone/camera, supports MP4 fallback and reports upload
failure without claiming the file was saved. Uploads use unique paths without upsert.

## Validation

- 59 tests passed across call components, call transport, LiveKit and recording.
- 33 PostgreSQL checks passed using PGlite with real RLS policies and the new migration.
- Production Vite/PWA build passed.
- TypeScript project check has 94 diagnostics already present on the unchanged base;
  baseline and branch checks were compared and have no new diagnostics.
- These checks simulate media/browser APIs and network failures. They do not prove
  actual iPhone audio/video capture or production storage access.

## Rollout and device acceptance

Apply `20261030013848_recording_consent_workflow.sql` before deploying this frontend.
The migration revokes legacy direct writes, so coordinate the release and refresh
older clients. No live database changes were made as part of this patch.

Using two accounts on physical devices, verify the request arrives, refusal cancels,
acceptance starts exactly once, both voices are present, MP4/video playback works,
pause/resume works, the saved file is private, and leaving/reconnecting cannot continue
an unapproved recording. Add a third participant to confirm a new request is needed.
A second device on the initiator's account must not create a second media recorder.

This patch does not add a recording library, server-side media capture, or automatic
recovery of an uploaded file when completion metadata cannot be saved. Files remain
private under the existing owner storage policy.
