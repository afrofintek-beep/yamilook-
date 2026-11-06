# LinkedIn direct publishing — activation and validation

Status: implementation behind two disabled-by-default flags. No credentials, database changes or real LinkedIn posts have been applied by this branch. The manual save/open flow remains available.

The flow is **connect LinkedIn → prepare branded export → load artwork → review text/audience → confirm publishing → view LinkedIn post**. This is a composer inside Yamilook, not an attempt to inject a file into LinkedIn's app editor. LinkedIn's Posts API creates published posts, not editable drafts in its native app.

## LinkedIn application setup

1. Create/select the application at https://www.linkedin.com/developers/apps under the appropriate AFROFINTEK/Yamilook ownership and associated company Page.
2. Enable **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**. Required scopes: `openid profile w_member_social`. Email is not requested.
3. Choose the actual canonical HTTPS Yamilook origin (apex or www), and register exactly `https://<canonical-host>/api/linkedin/callback` under Auth. Start authorization on that same host. Redirect other host aliases to the canonical host before enabling; session storage on alternate hosts is not interchangeable.
4. Store Client ID and Client Secret in the hosting environment. Do not put the secret in Git, frontend VITE variables, URLs or chat messages.

## Database and server configuration

Apply `supabase/migrations/20261106193216_linkedin_direct_publishing.sql` to the matching Supabase project after review. Tables use RLS with no browser policies and explicit privilege revocation from public/anon/authenticated. Only server service-role calls can access integration tables. Authentication and source-post authorization use the user's bearer token and the existing `account_current_session_id` RPC. No server function is added with SECURITY DEFINER.

Set server-only variables on the hosting project serving the canonical domain:

| Variable | Value |
| --- | --- |
| `LINKEDIN_CLIENT_ID` | Developer application's Client ID |
| `LINKEDIN_CLIENT_SECRET` | Developer application's secret, stored as a hosting secret |
| `LINKEDIN_ENCRYPTION_KEY` | Independent random 32-byte AES key encoded in base64; generate with `openssl rand -base64 32` |
| `LINKEDIN_ORIGIN` | Canonical HTTPS origin, no path or trailing slash |
| `LINKEDIN_API_VERSION` | `202610`, verified against current LinkedIn documentation; review version sunset before activation |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key for the same Supabase project |
| `VITE_SUPABASE_URL` | Existing project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing public client key |
| `LINKEDIN_PUBLISH_ENABLED` | Keep `false` until migration and credentials are ready; then `true` |
| `VITE_LINKEDIN_DIRECT_PUBLISH` | Keep `false` until preview validation; then `true` and rebuild |

Do not reuse the encryption key as a client secret. Rotating it requires users to reconnect and invalidates uncompleted uploads. Access tokens are encrypted with AES-256-GCM, authenticated with the Yamilook user ID. Upload instructions are encrypted separately with the draft ID. Tokens and signed upload URLs are never returned to the browser.

## Initial scope and limits

- Individual LinkedIn accounts, one selected branded image/card or MP4 per publication. Company Pages and multi-image batches are not implemented.
- MP4 up to 100 MiB; JPEG/PNG up to 4 MiB. Video uses LinkedIn's supplied inclusive part ranges, each at most 4 MiB, to stay below hosting request limits. Images above 4 MiB retain the manual flow.
- OAuth navigation returns to the prior Yamilook route. Connect before preparing media: the in-memory export cannot survive navigation. No publication happens during OAuth or upload.
- Video processing is checked with the explicit “Verificar processamento” control. Failure leaves a clear error; no automatic create-post retries.
- Tokens expire according to LinkedIn. Users reconnect rather than relying on an ungranted refresh-token product. Disconnect deletes local credentials and invalidates pending drafts; users can also revoke the app in LinkedIn settings.
- Source ownership, active session and source content fingerprint are checked before publication. A changed or hidden post cannot be published from an old draft.
- The final confirmation specifies PUBLIC or CONNECTIONS. This independently sets LinkedIn visibility; it does not change Yamilook post privacy.

## Duplicate prevention and uncertain results

A database compare-and-set `ready → publishing` precedes the sole Posts API request. Concurrent confirmation requests cannot both create a post. A known success returns its saved LinkedIn post ID on retry. A timeout, missing ID, or database failure after sending the request leaves `publishing/uncertain`; the endpoint never blindly retries. A second draft for that source post is blocked while this outcome remains unresolved.

The user must check their LinkedIn account in uncertain cases. An operator must reconcile the existing row with evidence before changing its state. Do not automatically reset `publishing/uncertain` to ready or delete these records: that would remove duplicate protection. Disconnect cannot recall a publish request already in flight.

## Validation before production activation

Automated local checks:

```
node --test tests/linkedin/*.test.mjs
npx vitest run src/components/sharing
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Use a configured staging deployment with a registered callback. The preview must have its own origin, matching cookie host, and callback entry. Authenticate with an authorized test LinkedIn account and verify:

1. Consent accepted, denied, expired, replayed and mismatched browser state.
2. Connect/disconnect, expired token, two Yamilook users and changed post ownership/content.
3. Prepared image and multi-part MP4 match the branded preview, including author and audio.
4. Upload errors and cancellation do not publish anything.
5. Explicit final confirmation creates one post with the selected audience, text and branded attachment. A double tap creates one post.
6. Network loss during final publication does not automatically retry; reconcile the result.
7. Actual iPhone/Safari and in-app browser navigation, then verify the post on LinkedIn.

Real OAuth, LinkedIn API permissions, provider processing and iPhone behavior cannot be certified by mocked tests. Keep both flags off until these checks pass.

## Operations

Run Supabase security advisors after applying the migration and confirm browser roles have no access to all four integration tables. Schedule cleanup of expired OAuth states/connections and expired upload ciphertext. Retain uncertain/publishing records until reconciliation; they enforce duplicate prevention. Remove expired `uploading/processing/ready/failed` rows after operational retention review. Do not log bearer tokens, authorization codes, signed upload URLs or provider response bodies.

Rollback: set `LINKEDIN_PUBLISH_ENABLED=false` immediately; disable `VITE_LINKEDIN_DIRECT_PUBLISH` and rebuild to remove the UI. Manual sharing remains available. Keep the tables until uncertain results have been reconciled.

## Primary references

- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
