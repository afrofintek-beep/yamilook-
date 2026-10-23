# Academia video verification

The Academia room uses its own authenticated `academia-video` endpoint and
`can_join_academia_room` authorization. The existing live/MOKUBICO endpoint is
unchanged. Mentor start/end rights are checked by `academia_set_live`.

- Mentor can start scheduled sessions at most 15 minutes early.
- Learners need a reserved place; paid sessions also require an authoritative
  Kumbu debit. Direct client writes to reservations are disabled; booking and
  cancellation use their existing billing RPCs.
- Each authorized user may publish camera/microphone and subscribe to others.
- Joining defaults to listening mode; media requires explicit opt-in.
- Camera/microphone refusal keeps the participant connected without media.
- Remote audio has a manual activation button for autoplay restrictions.
- Mentor end closes the LiveKit server room and marks the session ended;
  clients also poll session status every 5 seconds and disconnect on closure.
- Ending the video does not settle Kumbu. Existing “Concluir e receber” remains
  available to the mentor on the session detail screen after ending the room.
- Chat uses reliable LiveKit data packets; it is bounded to 100 messages in
  memory and is not persisted. Remote sender names come from the room participant.

## Automated checks

Run `npx vitest run src/features/academia/hooks/useAcademiaVideo.test.ts`.
Run `supabase/tests/academia_video_access.sql` through an authorized SQL runner.
The SQL test uses temporary fixtures and rolls back all changes.
Build with `npm run build`. Full repository type checking has pre-existing
errors; the Academia video files introduced no new reported type errors.

## Physical two-device validation (pending)

No physical-device or real camera/microphone pass is claimed. The local browser
binary could not be downloaded in the execution environment. The cloud browser
was redirected to the Yamilook sign-in screen.

Use two different accounts and a free test session. Do not call or invite
unrelated users. Remove disposable test fixtures after validation.

1. Device A (mentor) creates a free session starting within 15 minutes.
2. Device B (learner) reserves the session before its scheduled time.
3. A opens “Abrir sala de vídeo”, enables camera/microphone and starts.
4. B enters, opts into camera/microphone and allows browser device permissions.
5. Verify both participants see changing remote video and hear spoken audio.
   Use headphones or separate rooms to avoid feedback. Check manual “Ativar som”.
6. Mute/unmute and turn each camera off/on; confirm the remote effect.
7. Exchange chat messages. Leave B and confirm A remains connected; rejoin B.
8. Interrupt B's network briefly and verify reconnection or a clear failure.
9. A chooses “Encerrar para todos”; confirm B disconnects and cannot rejoin.
10. Repeat on iPhone Safari/installed PWA and Android Chrome, including Wi-Fi
    versus mobile data. Record actual devices, networks and observations.
