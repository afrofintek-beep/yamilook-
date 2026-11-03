# KOSOLOLA group conferences

The Contacts screen exposes the existing group creation flow. A group's voice/video buttons now open a member selector and a LiveKit conference, instead of starting a direct call with the first member. Groups retain the existing 256-member limit; each conference has at most eight reserved invitations/seats including its initiator.

Participants explicitly accept, decline, leave and rejoin. A joined participant can invite other members while slots remain. Leaving stops local hardware immediately and removes only that media identity; only the initiator can end for everyone. Minimize and group messages preserve the media session and remote audio. Camera refusal preserves voice, microphone refusal permits listening, and an audio unlock button handles browser autoplay restrictions. Portuguese and English copy is supplied; other languages use existing fallbacks.

## Deployment order

1. Apply `20261102235845_group_conferences.sql` to the existing Yamilook Supabase project.
2. Deploy `group-conference` with the existing `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Authentication is verified inside the handler through `auth.getUser()`; no service-role credential is sent to the client.
3. Deploy the frontend from the same reviewed commit.
4. Test real audio/video with at least three consenting accounts on iPhone and Android, including mobile data, permission refusal, reconnect, background/foreground and participant departure. Validate eight-party operation before expanding the cap.

## Authorization and recovery

Group membership and explicit invitations are checked by the database. Writes are only available through a caller-authorized private SQL function and a SECURITY INVOKER public wrapper; exposed tables have RLS and SELECT-only grants. Both the transactional database and LiveKit enforce the eight-seat cap. Device claims have a 90-second lease; clients renew every 20 seconds and stop media after authorization loss or repeated renewal failures. Direct-call creation also checks conference occupancy.

Authenticated heartbeats reconcile the actual LiveKit roster against live database leases and current group membership. Failed media removals are retried on later heartbeats. Conferences expire after four hours; clients close on renewal rejection. This is client-driven reconciliation, not an independent scheduled server watchdog: a room containing only clients that stop renewing is not guaranteed to be forcibly closed by the application while those clients remain connected. LiveKit's room lifetime controls still apply. No guarantee of reception with a locked/backgrounded mobile browser is made.

Conference invitations use authenticated Realtime with a visible-app polling fallback. Native/background push for group calls and converting an ongoing direct call into a conference are not part of this release. Group conferences currently use their own records, not the direct-call history table. Existing group admin and group-message features are reused.

## Verification

- PostgreSQL/PGlite tests exercise membership, atomic creation, blocked users, invitation/seat limits, device claims, caller occupancy, individual departure, revocation and end-for-all.
- Edge-handler tests exercise authentication, server-derived room identity, LiveKit capacity, token grants, failed setup/closure, and media roster reconciliation.
- Hook tests exercise media admission, late cancellation, listening mode, hardware teardown, retryable closure, authorization revocation and temporary network failure.
- Mobile WebKit tests exercise the actual Contacts/group entry points and selecting seven invitees. These use synthetic API data and do not validate real network media.
