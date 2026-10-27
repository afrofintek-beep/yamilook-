# Certificate lifecycle validation — 2026-10-27

The account-link implementation now returns versioned evidence with explicit `active` status, null revocation, owner relationship and exact issuer/audience/subject/address/link binding. Yamilook rejects missing lifecycle fields, revoked evidence, future issuance, ambiguous timestamps, invalid chronology, validity above 90 days and observations older than 30 seconds. It rechecks local phone validity after the partner response, rejects a removed local link and checks expiry again before returning. Positive observations do not set legacy certification flags or authorize payouts.

AFROLOC checks issuer authority before consent as well as at exchange/status. Future-dated evidence and missing/future/expired consent are denied. Returned validity is capped by certificate, link and phone expiry. A nonexistent certificate cannot be reported as successfully revoked. Existing certificate revocations and source-owner/code/revision checks remain authoritative.

## Verification

- 32 AFROLOC Node/PostgreSQL-WASM tests passed, including service-role execution, foreign ownership, changed source code/revision, loss of issuer authority, future/expired/revoked certificates, expired/revoked phone evidence, three revocation routes, replay, browser-role write/read/RPC denial and exact binding.
- 5 Yamilook evidence tests passed with adversarial lifecycle and time inputs.
- Cross-service HTTP-handler test passed against actual migrations/RPCs and SDK 2.90.1, with mocked authentication/SMS. It also checks local phone/link/address changes after a positive partner response and local revocation during partner outage. This is not live SMS or a real account acceptance test.
- Full Yamilook suite after merging current main and fixing the disabled-feature subscription: 549 tests in 86 files passed (`--maxWorkers=2`). The initial unconstrained run hit a video-editor timeout and exposed the subscription regression; the corrected full rerun passed.
- Both frontend builds passed; existing large-chunk warnings remain. Updated Edge handlers pass strict TypeScript checking against SDK 2.90.1.
- AFROLOC staging `vxeydrzuvhouvjnttvgs`: applied the incremental `partner_certificate_lifecycle` migration. Found and fixed missing service-role SELECT/row-lock permission on `afroloc_records` and EXECUTE on `has_role`. UPDATE is granted only on `updated_at` to enable PostgreSQL row locks; browser roles receive no new privileges. Confirmed RLS and no anon/authenticated read/write access to certificates, links or phone evidence. Service-role calls refuse unprivileged issuance and nonexistent links.
- Staging contains zero Auth users, source records and partner links. No test/production certificate was issued remotely; no real account or profile was changed. The staging authority already invokes the revised SQL RPC, so no multipurpose API deployment was needed.
- Advisors still show inherited unrelated findings. RLS-without-policy on the new evidence tables is intentional service-only access; see https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . No new browser grants were added.

## Remaining release boundary

Production remains disabled. The Yamilook staging branch `pufcziszxmymoaodslii` still lacks `public.profiles`, `afroloc_link_requests` and `account_verified_phones`; do not add a fake profile baseline or modify production migration history to bypass this. Dedicated staging secrets, restricted SMS credentials and matching staging frontends are still needed, followed by two independent authorized accounts, actual OTP delivery and an explicitly reviewed test certificate. The legacy AFROLOC phone-login retirement must also be released before trusting that authentication path.

No production rollout or claim of successful real certification is made. The screenshot's legacy payout gate remains suspended; financial authorization requires a separate point-of-use validation transaction, not this display observation.
