# KOSOLOLA brand application

The independent Papos application is presented as KOSOLOLA. Its existing `/papos-app/` scope, manifest ID, account storage and message routes remain compatible with installed clients and shared Yamilook accounts.

## Visual system

- Teal `#006568`, amber `#F5A21A`, charcoal `#22282B`.
- Local PNG icons derived from the supplied brand artwork at 192 and 512 pixels.
- Dedicated stylesheet scoped to `html[data-brand="kosolola"]`; portals inherit the same tokens. Yamilook pages retain their existing theme.
- Brand signature supports Portuguese, French, English, Lingala and Swahili with Portuguese fallback. Interface translations remain as previously implemented.
- Native install metadata, opening state, login, navigation, profile, settings and installation instructions use the new name.

## Compatibility and rollout

The public access path remains `/papos-app/`; this change does not configure a new domain. The manifest retains its identity so clients can update without creating a separate account. Mobile operating systems may refresh existing home screen labels and icons on their own schedule.

The new icons use distinct filenames to avoid reusing cached Papos artwork. The service worker precaches these branded icons while retaining the existing private-data exclusions.

No database migration or security change is included. Existing disclosure about the absence of end-to-end encryption is retained. Brand application does not imply a security certification.
