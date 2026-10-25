# Authorized account link v1 — staging implementation

This implementation adds independent, opt-in account links between Yamilook/KOSOLOLA and AFROLOC. It does not merge accounts, copy sessions, update Auth identities, replace passwords, migrate messages/contacts, write legacy profile certification flags or authorize financial actions. No production certificate is issued by deployment/migration; new evidence requires an explicit authenticated authority review.

## Components and protocol

- Each app has its own `account-phone` Edge Function and service-only phone evidence tables. An authenticated existing UUID requests an OTP with consent. The challenge is tied to that UUID and a phone-verification purpose, expires in 5 minutes, allows at most 5 guesses, and is consumed atomically with the phone association. HMAC-SHA256 uses a server-only pepper. OTPs are not persisted in plaintext. SMS rejection/timeout cancels the challenge. Requests are limited to 1/minute and 5/hour per account, plus 5/hour per phone. A number reserved by another account is never reassigned or merged, including after revocation: recovery requires a separate reviewed process. Phone possession evidence expires after 180 days and can be revoked. This is separate from Supabase native `phone_confirmed_at`, civil identity and address certification.
- Yamilook `account-link` starts a request using the logged-in UUID and the exact currently declared code, after phone confirmation and explicit consent. A random verifier remains in its service-only database; only its SHA-256 digest reaches AFROLOC. The public request UUID is not sufficient to exchange the grant.
- AFROLOC `account-link-authority` is a new, dedicated endpoint. It does not replace the multipurpose `api-v1`. The user signs into AFROLOC separately, confirms the recipient/account reference and exact address, and explicitly approves. The AFROLOC account must have current phone possession evidence and a current, authority-reviewed certificate for that code. Requests expire in 10 minutes.
- The original Yamilook account completes the exchange. Server-to-server authentication uses a new high-entropy `ACCOUNT_LINK_PARTNER_KEY`, not a user session. The one-use exchange requires the correct subject and verifier. An ambiguous timeout is recovered with a scoped status check, not replaying or sharing sessions.
- Every subsequent check reads current source evidence. The result contains issuer `afroloc.ao`, audience `yamilook`, local subject, exact code, opaque link/evidence IDs and timestamps. The consumer rejects stale observations, mismatches and expired evidence. No positive result is persisted as a permanent `certified` flag. Mutating privileged operations must independently verify the evidence at point of use; this version only displays a current observation.
- The owner can revoke on either side. Local revocation is persisted before contacting AFROLOC, so a partner outage cannot leave the local link usable. Retry an incomplete remote revocation. Links expire at the earlier of certificate expiry and 90 days from consent.

## Certificate authority boundary

`partner_certificates` is a new service-only evidence register. It does not import old `certified` flags or assume legacy profile phones prove identity. `issue` requires the authenticated AFROLOC `admin` role, explicit review, a non-self subject and expiry no later than 90 days. The RPC snapshots record ownership, exact code and `updated_at`; changed source records invalidate evidence and require review. Removal of the issuing admin role also fails subsequent checks. `revoke_certificate` requires an admin. The legacy certification lifecycle is not silently treated as equivalent to this new reviewed evidence register.

Example for an authorized reviewer in the AFROLOC app session, only after reviewing the actual evidence:

```json
{"action":"issue","id":"<reviewed record UUID>","consent":true,"expires_at":"<explicit UTC expiry within 90 days>"}
```

This is an explicit issuance operation, not an automated migration or a request to issue real certificates during testing. Do not expose service-role keys. Two-account tests use fixtures or specifically authorized test records.

## Storage and access

All new tables have RLS enabled and no browser-role access. All RPCs are SECURITY INVOKER, have a fixed search path, revoke PUBLIC/anon/authenticated execution and grant only service_role. The Edge Function derives the actor from `auth.getUser`; it never accepts a caller-provided actor UUID. The partner's subject comes only through the authenticated partner channel. Issuance/revocation authorization is checked again in SQL. Row/advisory locks serialize grant exchange, OTP attempts and conflicting phone claims. Audit events contain actor IDs and event names, not OTPs, full phones, messages or session tokens.

Operational retention: delete consumed/expired phone challenges and abandoned link requests older than 7 days via a service-only maintenance job. Keep audit/evidence retention under the organization's approved policy. Do not delete phone reservations as an automatic number-recycling mechanism.

## Release prerequisite

Yamilook PR #28 must be merged before deploying the complete repository: its suspended `afroloc-verify` source must match the safe function already deployed. This change does not reactivate that legacy adapter.

## Staging deployment order

1. Create isolated Supabase development branches with no production user data. Apply the new migration from each corresponding repository, then inspect grants/RLS/advisors. No destructive migration is included.
2. Deploy `account-phone` on both branches; `account-link-authority` on AFROLOC; `account-link` on Yamilook. They authenticate internally (`verify_jwt=false` is scoped to these new functions). Do not change `api-v1` or reactivate `afroloc-verify`.
3. Server secrets in each branch: `ACCOUNT_LINK_V1_ENABLED=true`, independently generated `ACCOUNT_PHONE_OTP_PEPPER` (at least 32 characters), `INFOBIP_BASE_URL` (HTTPS subdomain of api.infobip.com), `INFOBIP_API_KEY`, `INFOBIP_SENDER`. Use a restricted test provider/account and approved destinations. Shared only between the two servers: new `ACCOUNT_LINK_PARTNER_KEY` (at least 32 characters). Store secrets through the platform, never in Git/chat/frontend variables.
4. Yamilook server: `AFROLOC_LINK_ENDPOINT=https://<AFROLOC staging ref>.supabase.co/functions/v1/account-link-authority`; `AFROLOC_CONSENT_URL=https://<AFROLOC staging frontend>/account-link`. These URLs come from server configuration, never request input. Set frontend `VITE_ACCOUNT_LINK_V1_ENABLED=true` only in matching staging deployments; point frontend Supabase variables to their respective branches.
5. Default is disabled: absent server or frontend readiness settings yields `integration_pending` / hidden controls. Do not enable production before real staged verification. Keep independent email/password access.
6. Test two authorized accounts, real SMS delivery, denial of another user's OTP/request, duplicate number, expired/replayed challenge, changed declared code, certificate expiry, revocation on either side, source ownership/address changes, partner outage and recovery. Verify existing UUIDs, profiles, messages and contacts are unchanged.
7. Only after those checks, review a production rollout. Existing phone-login vulnerabilities documented in `partner-certification-readiness.md` must be resolved or excluded from the trusted authentication path before production activation. This work does not silently upgrade that legacy login path.

## Local verification

Node 24 required for TypeScript imports in Node tests.

```sh
npm ci
npm run test:account-link
# AFROLOC checkout: HTTP/SQL cross-service test, with matching Yamilook checkout:
YAMILOOK_REPO=/path/to/yamilook ACCOUNT_LINK_TEST_SDK=/path/to/@supabase/supabase-js/dist/index.mjs node tests/account-link/edge.integration.mjs
```

The SDK used by that integration test must be exactly 2.90.1, matching the Edge import. PGlite executes the actual migrations and RPCs in local PostgreSQL WASM. The HTTP integration test uses the real handlers and real SQL with mocked Auth transport and SMS; it refuses unexpected network destinations. It demonstrates the local flow, not hosted/SMS delivery or concurrent multi-process PostgreSQL behavior.

Validation at implementation: 8 SQL tests, 3 consumer evidence tests, 2 phone-consent UI tests, and the cross-service HTTP/SQL scenario pass. Both frontend production builds pass. Edge code typechecks against exact Supabase SDK 2.90.1 and Deno ambient interfaces; direct Deno dependency download was blocked by network access. Whole-repository Yamilook tsc reports existing errors outside the new account-link code; build success is not a clean full-repository typecheck.

## Hosted staging result — 2026-10-25

AFROLOC isolated branch `vxeydrzuvhouvjnttvgs` successfully applied this migration and deployed `account-phone` and `account-link-authority` v1. Unauthenticated HTTP checks are refused. The new RPCs are SECURITY INVOKER and not executable by anon/authenticated. No production data was copied and no SMS or certificate issuance was performed. Readiness/secrets remain unset.

Yamilook development branch creation failed before this migration: `MIGRATIONS_FAILED`, PostgreSQL `relation public.profiles does not exist`. The parent's earliest registered migration is `20261022133534 single_use_invitations`, which references profiles without a recorded baseline. Restore a reviewed, reproducible schema baseline for isolated staging before applying this feature. The failed empty branch was removed; do not repair production migration history blindly.

Remaining rollout dependencies: Yamilook schema baseline, merge Yamilook PR #28, dedicated partner secret and independent OTP peppers, restricted Infobip test credentials/destinations, matching frontend staging deployments, authority-reviewed test certificate, and real two-account acceptance tests. Legacy AFROLOC login must be secured or excluded before production activation. No common identity is operational.

The AFROLOC advisor also reports inherited schema findings (legacy function search paths, PostGIS placement and exposed definer functions). New tables intentionally have no client policies: only service-role access. See the [RLS/no-policy advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
