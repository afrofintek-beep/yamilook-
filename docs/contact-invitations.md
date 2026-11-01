# Contact invitations

The invitation sheet now starts with WhatsApp, email and a copyable-link option. No recipient email or address-book upload is required. Preparing a link is a separate step from opening the recipient application, preserving browser user activation for iOS native sharing. Email uses a mailto draft with an empty recipient. Sending is confirmed in the chosen application; opening a composer does not imply delivery.

An optional “Convidar um email específico” section retains the previous email-bound invitations and automatic email delivery.

## Database deployment

Apply `20261101190239_shareable_contact_invitations.sql` before deploying the frontend. It is additive/backwards compatible with existing clients and email-bound invitations. No Edge Function deployment is required.

`issue_shareable_user_invitation(uuid)` checks the existing invitation permission and serializes issuance per issuer. Client retries reuse a request UUID; new contacts use a fresh one. New links expire after seven days and are limited to 100 per issuer per rolling 24 hours. Only authenticated authorized issuers can call the RPC; RLS and existing SELECT-only grants remain unchanged.

These are bearer links: the first successful registration claims the invitation, so they should be shared with one intended recipient. The signup trigger locks the row, checks expiry and issuer permission, binds the actual signup email, records the user and consumes the link in the same transaction. A failed signup rolls back consumption. Existing invitation codes, legacy registration and permission delegation remain compatible.

## Verification

- `npm test -- src/components/settings/ContactInviteActions.test.tsx src/components/settings/InviteSheet.test.tsx src/lib/invite-delivery.test.ts src/lib/invitation-registration.test.ts src/lib/referral.test.ts src/lib/public-site.test.ts src/test/integration/auth.test.tsx --reporter=dot`: 53 tests.
- `node --test scripts/test-contact-invitations.mjs`: PostgreSQL assertions for authorization, RLS, retry idempotency, unique redemption, expiry, missing/wrong email, rollback, revoked issuers, daily limit and legacy email invitations. PGlite runs on a single connection; separate-process concurrency is not simulated.
- `npx tsc --noEmit -p tsconfig.app.json` and `npm run build`.
- Sending through WhatsApp/Mail on a physical iPhone still requires device validation.

Rollback: redeploy the previous frontend. Keep the additive schema so already-issued links remain redeemable; do not revert the signup trigger while such links exist.
