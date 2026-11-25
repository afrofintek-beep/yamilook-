# MAGUELA × AFROLOC × LOCACCESS — transport authorization

## Phase 1: distinct owner designation of a public pickup reference

The owner of a LOCACCESS address can explicitly designate a public AFROLOC reference (e.g. a gate) for an existing recipient. Ordinary visit grants do not imply transport consent. The designated reference is owner-entered, not derived from the private source. The issuer denies known protected codes and the residence code. MAGUELA must resolve the reference through its existing official public lookup before accepting it; the issuer does not independently certify public status. No coordinate, private source reference, session credential or grant token is transferred. The recipient explicitly copies the designation into MAGUELA and confirms it. No URL parameter or shared authentication is introduced.

The separate private table uses RLS, no direct client table access and an authenticated invoker wrapper over checked private logic. Every lookup rechecks session, recipient, active account, source, grant version, revocation and expiry; response lifetime is at most 20 seconds. The recipient can neither set nor renew designation. A withdrawn/expired grant stops future consultations; a public reference deliberately copied before revocation cannot be recalled and is not a revocable private transport capability.

## Phase 2 (not enabled): exact private pickup

Existing LOCACCESS visit leases are intended for the authenticated recipient only, expire within 20 seconds and may require proximity. They do not authorize sharing coordinates with a transport platform or driver, persistence in RideRequest, quote, offline cache, ledger, or routing providers. MAGUELA currently persists pickup coordinates and exposes them within authorized ride flows. Do not route an ordinary visit lease through that flow.

Required before enabling private pickup:
- Explicit owner consent for transport purpose, designated recipient and permitted driver disclosure, independent of ordinary visit or NJILA continuation.
- Cross-app authenticated account binding with one-time, expiring challenge; no trust in phone text, QR handle, client coordinates, or unsigned identity. Separate issuer audience and purpose; deny replay and cross-account redemption.
- Server-side AFROLOC source and LOCACCESS grant checks, revocation/expiry and proximity at each sensitive transition. Route and fare calculations must not reveal precise coordinates to unauthorized providers or drivers. Establish a safe public meeting point if precise disclosure is prohibited.
- Dedicated opaque pickup capability and lifecycle, no raw private point in public discovery, persistent logs, normal ride history, offline cache or receipts. Define revocation during active ride, safe stopping/meeting and deletion retention with explicit policy. No offline private location by default. Do not extend original issuer deadline or infer presence from client GPS.
- Test owner/recipient/driver separation, revoked and expired grants, changed addresses, replay, forwarding, clock rollback, offline, routing, fare and cancellation. Physical two-device verification and staged deployment before production.

This PR is a first-stage public handoff, not a private ride authorization or completed single sign-on integration. It requires the issuer migration and UI deployment plus the validated MAGUELA SMART PICKUP flow. No production changes are performed by the PR itself.
