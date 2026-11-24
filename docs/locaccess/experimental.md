# Yamilook LOCACCESS experimental

The current AFROLOC card now uses `/afroloc/acesso/<opaque UUID>`. QR clicks and the map action open the same Leaflet view with Mapa/Satélite. The owner sees their saved point; other accounts must have a current recipient grant. Immediate access removes the distance requirement, not the account requirement. All access starts closed.

Owners authorize an exact Yamilook username at 100/250/500 metres or immediately, for 1 hour/24 hours/7 days. They can revoke one recipient or all. Reopening never restores previously revoked grants. Ambiguous case-insensitive usernames are rejected. Current account/session, source owner, unchanged address code, source status and expiry are checked on the server. Private tables have RLS and no client table privileges; the public RPC is an invoker wrapper around checked private logic.

Location responses expire within 20 seconds, source expiry, or grant expiry, whichever comes first. Both exact points and approximate areas now carry that server deadline. The viewer refreshes every 5 seconds and independently expires the response if renewal hangs. The ordinary address view clears offline and when a retry starts. Radius checks require fresh device coordinates, bounded accuracy, and distance plus accuracy within the selected radius. Device-reported GPS can be spoofed: this is an experimental proximity convenience, not proof of physical presence. The approximate 2 km area is visible only to an authorized recipient before exact disclosure. Map providers receive tile requests.

## Brief offline continuity in NJILA

The owner can explicitly select **Permitir continuidade breve sem rede na NJILA** when granting access. This choice belongs to each recipient grant and is off by default, including all grants created before the migration. A request that omits the choice, including re-authorizing an existing recipient, stores `false`. The backend accepts only a JSON boolean from the owner-bound `grant` action; a visitor cannot opt themselves in through the `visit` request. Google Maps entrance sharing and proximity settings remain independent.

The issuer returns `offlineContinuation: "permitted"` only for a recipient whose current grant has that consent. Other visits return `"forbidden"`. If the network is lost after NJILA received a permitted response, the parent can retain only the already disclosed point or area for the remainder of its original deadline, in memory in that session. This is at most 20 seconds, often less; it is not an authorization for an entire offline journey. There is no offline renewal, storage entitlement or increase in precision. An old server response without the field remains online-only. Legacy approximate responses without a server expiry remain online-only and are bounded locally.

The client also caps the response using a monotonic deadline measured from the start of the request, so response latency and a backwards wall-clock adjustment cannot add time. Replaying the same expiry cannot extend or revive its deadline. Positive replies received after connectivity is lost are discarded. A received denial or authentication error clears access immediately; when revocation cannot be received offline, the original short deadline still ends access. Backgrounding, page exit, unmounting, changing the iframe audience and expiry always clear the response. Credentials, handles and points do not enter the iframe URL; only validated messages from the expected NJILA window and origin can establish the channel.

Deploy `20261124164906_locaccess_offline_continuation.sql` before the new owner interface. It adds `locaccess_private.grants.offline_continuation NOT NULL DEFAULT false` and replaces the checked private RPC implementation; it does not change earlier migrations, table privileges, RLS, current grant expiries or the invoker wrapper. The owner must explicitly grant the new choice; deploying the change alone authorizes no existing recipient for offline use.

Shared/copied/printed/downloaded cards omit the exact AFROLOC code and fine address fields, using the opaque access QR instead. The owner's private on-screen card still contains their address code: screenshots can expose it. Previously distributed codes encode coordinates and cannot be made secret retroactively; old QR images must be replaced. The legacy Yamilook lookup denies protected codes, but independent decoders/copies remain outside this control. This does not modify the separate Feira LOCACCESS.

Addresses without saved valid coordinates fail closed; this release does not infer a new point or change an owner's residence. Existing pending/approved temporary addresses remain subject to their original expiry. No auth triggers, existing address records, users, invitations or billing were rewritten.

Validation for continuity includes isolated PGlite checks of migration compatibility, owner and recipient permissions, strict consent input, the 20-second/grant/source expiry minimum, revocation, authentication, table privileges and RLS. Frontend regressions cover consent, network loss, in-flight replies, clock changes, suspended renewal, retry, proximity expiry and session cleanup. The `LOCACCESS continuity` workflow runs these checks and TypeScript without production credentials. These automated tests do not impersonate real accounts or authorize real recipients; physical two-phone/GPS/Safari testing remains separate.

Commands:

- `node tests/locaccess/database.cjs`
- `npx vitest run src/features/afroloc-card src/shared/afroloc-card src/features/academia/community-links.test.ts src/features/locaccess`
- `node --test tests/afroloc-card-location/handler.test.mjs`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run build`

The Supabase advisor reports no-policy INFO for these deliberately inaccessible private tables. Existing unrelated public schema/auth advisor findings remain outside this change; this is not a whole-platform security approval.
