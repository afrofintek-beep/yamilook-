# Comment mentions verification — 5 November 2026

## Production evidence

PR #160 was live on `https://www.yamilook.com`: Vercel production deployment `dpl_J6JE7mXFTR1YgdgNgC68BdCDFLE8`, READY, commit `7d809490b29c37c3988ba19adf390957038c0364`. This establishes publication of the feature, not a successful real-account user journey.

The browser opened the welcome page without an authenticated session. No two designated, signed-in accounts were available. No real user was impersonated and no real comments or notifications were sent.

## Confirmed privacy defect

Production `post_comments` had SELECT policy `Anyone can view comments` with `USING (true)`, while posts enforce visibility. The PR's claim that recipient RLS protected mentions was therefore incorrect.

A transaction on production inserted two synthetic identities and a private post/comment, assumed the ordinary authenticated database role for the synthetic recipient, and confirmed: the post was not readable, but its comment was readable. All test records were rolled back. This is a real database-policy reproduction, not an authenticated two-browser test.

## Corrections

- Comment SELECT checks parent-post RLS, hidden post/comment flags and bidirectional blocks involving the recipient, post owner and comment author. INSERT/UPDATE also enforce parent access.
- Notification reads join visible parent posts and exclude hidden rows before deriving mentions. Exact-handle parsing avoids email and prefix matches; sender name/avatar replace the recipient's own handle in the notification title.
- Notification requests from a previous account cannot overwrite the next account's list.
- `/discover?post=...` resolves the referenced post under current recipient permissions and opens its comments; revoked access returns an unavailable message.
- Mention links close the comment overlay in feed and Ritmos.
- Failed comment writes remove the optimistic row, restore the text/reply target and report failure. Duplicate submits are prevented while pending.

## Validation and remaining release gate

The 24 PGlite PostgreSQL checks reproduce the old leak and test public/private/contact/close-friend reads, grants and revocations, hidden content, ownership, forbidden writes and both block directions. Application tests cover picker selection, similar usernames/photos, keyboard selection, publication failure, profile links, recipient notification derivation and notification-post access.

All 1,055 application tests passed across 174 files with the documented test Supabase environment. The focused mention/profile group contains 47 passing tests. Type checking and production build passed. The dedicated GitHub workflow repeats the relevant checks on the PR.

Applying the hosted migration was attempted twice; both Supabase confirmations expired. A subsequent policy read confirmed the migration was NOT applied. Do not treat the database privacy defect as fixed until `20261105143445_comment_mentions_privacy.sql` is applied and `tests/comment-mentions/production-rollback.sql` passes. Frontend parent-post checks provide a separate mitigation but do not repair direct API access or the missing block enforcement in production.

The real-account acceptance test remains outstanding: designated sender and recipient sessions must verify lookup, correct selection, posting, clicking the mentioned profile, recipient notification and denial after privacy revocation. Do not request or share passwords in chat.

## Separate product limitations

- Feed mention notifications are derived when opening Notifications: previous seven days, at most 50 candidate comments. They are not a persisted delivery queue.
- Ritmos supports @ suggestions and clickable handles; mention notifications for Ritmos are not implemented.
- Push notifications for comment mentions are not implemented.
