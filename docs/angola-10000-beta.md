# Angola: 10,000 participants and five invitations

## Scope

The public `/angola` page, login/feed banners, optional invitation for Angola onboarding, member invitation panel and administration report use `public.angola_beta`. Angola is self-declared residence, not geolocation proof or nationality verification. Existing AFROLOC certification, paid external services, anti-abuse controls, and fair invitation campaigns are unchanged. No messages are sent automatically; users choose whether and how to share. The existing group creation sheet is accessible directly from the invitation panel; no automatic membership or contact import.

Each eligible member receives five single-use codes after email/phone confirmation. Invited users receive the same five after confirmation. Codes expire with the campaign and do not reserve capacity. Pending registrations reserve capacity; the public count includes only active, confirmed, non-excluded members. This is an account count, not independently verified unique people. Previously registered active Angola accounts are included, excluding administrators and internal `@yamilook.test` accounts. Other known test accounts should be reviewed administratively before broad promotion.

The cohort is capped at 10,000 reservations, including pending confirmations. Reservations are deliberately not automatically expired: late email confirmations must continue to work. Support should inspect pending registrations rather than delete legitimate accounts to recover capacity. The row lock and revision update serialize admission; downstream Auth/profile errors roll back both reservation and invitation consumption. Repeatable-read conflicts fail safely.

## Rollout

1. Apply migration `angola_10000_banda_invites` (initially disabled) to the verified Yamilook project.
2. Verify functions/permissions and baseline counters. Do not manufacture registrations for a public counter.
3. Deploy matching frontend and verify `/angola`.
4. Set `enabled=true`, `starts_at=clock_timestamp()`, `ends_at=clock_timestamp()+interval '60 days'` through trusted database access; the Admin panel can subsequently pause/reopen admissions. Ending/pausing the campaign does not block existing accounts or delete content. No automated charge is introduced.
5. Observe registration confirmation and real device reports. Local fixtures do not demonstrate SMTP delivery, sustained capacity at 10,000 users, payment costs or live call capacity.

Emergency containment: set `enabled=false` in the private config or use the administrative pause button. Do not drop tables, recreate users or restore old profile triggers over enrolled accounts. Legacy non-campaign invitation logic is preserved in place by checked function patches.

## Measurement

Administrator report: reservations, confirmed accounts, pending confirmations, active in 24h/7d, approximate presence in five minutes, consumed invitations, waitlist size and last 50 feedback messages. Presence is based on profile `last_seen`, not a measured concurrent connection count. Costs and infrastructure errors remain in existing provider monitoring; this panel does not pretend to integrate billing. Public responses expose aggregate counts only; member responses never identify recipients. Waitlist is consented, email-deduplicated, bounded to 20,000 and does not send email or guarantee admission. Feedback is limited to five messages per member/hour.

## Validation

`node --test tests/angola-beta/database.test.mjs`: PGlite/PostgreSQL integration using captured production legacy Auth function definitions and a minimal synthetic schema. Covers backfill, permissions, confirmation, five-slot idempotency, single use, attribution, rollback, cap, pause, expiry, legacy flow, consent and feedback throttling. Requests queued through PGlite are not a multi-connection load benchmark.

`npx vitest run src/features/angola-beta/AngolaBeta.test.tsx src/components/settings/InviteSheet.test.tsx src/pages/Register.test.tsx src/lib/signup-onboarding.test.ts src/lib/invitation-registration.test.ts`: user-interface and registration regressions. TypeScript and Vite build also required. No real contacts, invitation emails or SMS are sent by tests.
