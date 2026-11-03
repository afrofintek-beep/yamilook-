# Branded sharing implementation — work in progress

Requested: preserve Yamilook identity and author on exported videos, photographs and text cards, preview before handoff, retain the original post audience.

Implemented foundation: `src/lib/branded-media.ts` renders an independent photograph copy with a Yamilook/author header outside the content area. It does not mutate the original or request new access.

Not connected to production UI. Video export needs a verified encoding path that preserves original audio, timing and compatibility on iOS/Android. The repository currently has no video transcoding worker. Browser MediaRecorder/canvas recording is real-time and needs explicit compatibility, audio and background-interruption verification; it must not silently generate a mute or incomplete video. No production feature flag or button should claim branded video support until actual sample exports pass playback checks.

Remaining: authoritative author metadata, official logo rendering, export preview and object-URL cleanup, text cards, video encoder and cancellation/memory limits, public-link preview images, regression tests and production release. Existing public and restricted file sharing is unchanged.
