# Direct call transport migration

New direct calls use a LiveKit room named `call-<existing call UUID>`. Existing call rows remain authoritative for invitations, history, decline and hangup. The server checks authenticated identity, direct invitation, participant membership and nonterminal status before granting access. The marker in `sdp_offer` selects the transport; it is written before dispatching the push notification. Existing unmarked calls and group calls continue through WebRTC.

LiveKit manages media transport and recovery. The client enables echo cancellation, noise suppression, automatic gain, audio DTX/RED, adaptive subscriptions and video simulcast, with a 640×360/24fps capture default. The UI does not treat joining an empty room as a connected peer call. Local devices stop synchronously before hangup persistence. Asynchronous token requests are cancelled by generation, and a temporarily absent peer has a 45-second grace period. A separate audio sink and an explicit audio-unlock button handle browser autoplay rejection. Chat and controls remain available alongside video.

## Verification

- General Vitest suite: 91 files, 575 tests passed with dummy Supabase configuration (no production credentials).
- Focused call/transport/audio suite: 6 files, 26 tests passed, including duplicate answer, legacy routing, in-flight cancellation, peer reconnect, remote hangup, immediate local release and authorization rejection.
- Vite production build passed.
- Changed production TS/TSX lint: no errors; two pre-existing Fast Refresh warnings in ActiveCallProvider.
- Project-wide TypeScript checking has existing errors outside the changed production files, including feed test fixtures, test globals, replaceAll target and LiveAccessInfo cast. No diagnostics in the changed production files in the checked revision.

## Release gates

The production Edge Function has NOT been replaced: automatic approval review rejected deployment because it changes the live token issuer and publication requires approval. The backend change must be deployed before clients are enabled. Do not merge this draft and automatically promote the frontend ahead of that deployment.

Both test clients must refresh to the new application version. Older cached clients cannot answer a new LiveKit-marked call; this is a coordinated rollout requirement. Existing unmarked calls still use WebRTC on updated clients. Group calls are intentionally not migrated in this change.

Then verify two real accounts on iPhone and Android/desktop: both-way voice, camera, mute/unmute, camera switching, audio unblock, chat while speaking, reject/no answer, both-way hangup, slow network, separate networks, Wi-Fi/mobile handover, temporary loss and reconnect, background/resume. Measure establishment time, drops, recovery time and audio quality before claiming parity with any other platform. No such benchmark or end-to-end encryption implementation is claimed here.

Admission tokens are short lived (10 minutes); an already issued token is not instantly revoked by a database hangup. Client reconciliation disconnects both sides. Strong server-enforced room deletion/revocation and native background call integration remain separate work, and should be evaluated before a wider security/availability parity claim.
