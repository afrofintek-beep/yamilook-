# Yamilook LOCACCESS experimental

The current AFROLOC card now uses `/afroloc/acesso/<opaque UUID>`. QR clicks and the map action open the same Leaflet view with Mapa/Satélite. The owner sees their saved point; other accounts must have a current recipient grant. Immediate access removes the distance requirement, not the account requirement. All access starts closed.

Owners authorize an exact Yamilook username at 100/250/500 metres or immediately, for 1 hour/24 hours/7 days. They can revoke one recipient or all. Reopening never restores previously revoked grants. Ambiguous case-insensitive usernames are rejected. Current account/session, source owner, unchanged address code, source status and expiry are checked on the server. Private tables have RLS and no client table privileges; the public RPC is an invoker wrapper around checked private logic.

Location responses expire within 20 seconds, source expiry, or grant expiry, whichever comes first. The viewer refreshes every 5 seconds, drops a point on errors/offline/background and independently expires it if renewal hangs. Radius checks require fresh device coordinates, bounded accuracy, and distance plus accuracy within the selected radius. Device-reported GPS can be spoofed: this is an experimental proximity convenience, not proof of physical presence. The approximate 2 km area is visible only to an authorized recipient before exact disclosure. Map providers receive tile requests.

Shared/copied/printed/downloaded cards omit the exact AFROLOC code and fine address fields, using the opaque access QR instead. The owner's private on-screen card still contains their address code: screenshots can expose it. Previously distributed codes encode coordinates and cannot be made secret retroactively; old QR images must be replaced. The legacy Yamilook lookup denies protected codes, but independent decoders/copies remain outside this control. This does not modify the separate Feira LOCACCESS.

Addresses without saved valid coordinates fail closed; this release does not infer a new point or change an owner's residence. Existing pending/approved temporary addresses remain subject to their original expiry. No auth triggers, existing address records, users, invitations or billing were rewritten.

Validation: 41 isolated PGlite database checks, 47 frontend/unit tests and 5 public lookup handler tests; TypeScript and production build. Production RPC privileges/RLS checked and legacy edge function deployed. No real account was impersonated, no actual recipient authorized by the implementer, no physical two-phone/GPS/Safari test. Browser launch is unavailable in this execution environment.

Commands:
- `node tests/locaccess/database.cjs`
- `npx vitest run src/features/afroloc-card src/shared/afroloc-card src/features/academia/community-links.test.ts src/features/locaccess`
- `node --test tests/afroloc-card-location/handler.test.mjs`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run build`

The Supabase advisor reports no-policy INFO for these deliberately inaccessible private tables. Existing unrelated public schema/auth advisor findings remain outside this change; this is not a whole-platform security approval.
