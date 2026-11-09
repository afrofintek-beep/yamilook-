# Phone access rollout (draft)

This change links a phone to the current Auth user with `updateUser`, verifies
`phone_change`, and logs in existing accounts with `signInWithOtp` (no auto signup).
It does not merge identities, modify profiles, or replace email authentication.

Directory searches require an authenticated non-anonymous caller, exact E.164
number, explicit target consent for the currently verified phone, and no block
in either direction. The server limits searches to 30 per hour per account.
Phone values are never returned by the directory or added to public profiles.
RLS denies direct client access to preferences, quotas and audit events.
Audit events contain actor/action/time, never the queried number or OTP.
Native Auth maintains the authentication audit trail. Consent becomes ineffective
when the verified phone changes. Revocation stops subsequent searches.

## Activation order

1. Apply `20261109014124_phone_access_directory.sql` after staging verification.
2. Attach `reject_phone_only_signup` to Auth's **Before User Created** hook.
   If another hook exists, compose the check into it; do not replace existing rules.
   Verify direct phone signup is denied, while existing email signup rules remain.
3. Configure a funded SMS provider, sender and permitted Angola delivery route.
   The production dashboard currently shows Phone disabled and empty Twilio credentials.
   Infobip requires a separately configured, signed Send SMS hook; this PR does not
   configure that hook or assume an Infobip account is ready.
4. Enable Phone with phone confirmation mandatory. Use six digits, short expiry
   (recommend 300 seconds), provider/Auth rate limits, no fixed production test codes.
5. Deploy `phone-directory` plus its shared module, set `PHONE_ACCESS_ENABLED=true`.
6. Build staging with `VITE_PHONE_ACCESS_ENABLED=true`. Both flags default off.
7. Test account linking, duplicate number rejection, wrong/expired/reused OTP,
   email login, SMS login preserving user ID and conversation access, consent on/off,
   both block directions, and quota exhaustion. Verify actual handset delivery and
   sender identity on UNITEL and Africell, including time to delivery and provider status.
8. Complete remaining locale translations (new pilot UI is PT/EN), security review,
   and live carrier checks before production rollout.

No live SMS has been sent. No user phone has been changed. Both supplied test
numbers are UNITEL; an authorized Africell test number is still required.
Do not store test users' personal details, OTPs or provider credentials in this repo.

## Verification

- `npx vitest run src/features/phone-access/api.test.ts`
- `node --test tests/phone-access/directory.test.mjs` (embedded Postgres/PGlite)
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run build`

Automated tests use mocks for SMS and a fixture schema for SQL, not a real carrier
or a full Supabase Auth environment. Live end-to-end tests remain outstanding.
Disable the frontend flag and Edge Function server flag to roll back the UI and
search endpoint. Do not erase linked phone identities as part of UI rollback.
