# Incoming call waiting

A connected direct LiveKit call can receive one additional ringing invitation. A compact notice identifies the caller and voice/video type. A quiet 300 ms pulse repeats every 8.3 seconds; ringtone silence and disabled-ringing preferences are honored. The existing conversation continues until the user declines the invitation or explicitly chooses **End current call and answer**. Pending invitations retain the existing timeout/cancellation behavior.

This is incoming call waiting, not hold/resume of two answered calls. Group conferences and legacy active WebRTC calls still report busy. A third caller receives busy. A call active on another device must be ended on that device before accepting another invitation.

`end_direct_call_for_waiting` validates both calls under account/row locks before ending the specified current call. A cancelled, expired, already claimed or unauthorized invitation cannot end it. The transport releases old microphone/camera/screen tracks before claiming and connecting the new call. A cancellation after the old call has ended may still prevent connection to the new caller; the old conversation is not automatically restored. Existing recording sessions unmount and finalize before they can receive the new call's media.

Deployment: apply `20261106162641_direct_call_waiting.sql` before publishing the frontend. The new call-claim guard also prevents older clients from opening a second call over an ongoing one. No new public table grants or media permissions are introduced. All new UI copy has keys in the ten active interface languages.

Validation: isolated PostgreSQL admission/claim/switch tests in `scripts/test-direct-call-waiting.mjs`, transport and provider race tests, incoming overlay tests, quiet/silent ringtone tests and recording handoff tests. Physical three-account iPhone testing remains necessary to verify audible waiting and real media handoff.
