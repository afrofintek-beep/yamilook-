# Public post sharing

The feed used to copy `/post/:id` links even though no route existed. The posts SELECT policy also excluded anonymous readers. Public posts now have a server-rendered page on the same canonical URL, with complete text, image/video controls and Open Graph/Twitter metadata. Viewing needs neither login nor JavaScript. The React fallback covers navigation within the app and old service workers; direct public routes skip authenticated providers.

The share button uses the native device sharing sheet with clipboard fallback. The copy-link menu still copies directly. Both use `https://www.yamilook.com`, including when the app runs on a preview or alternate domain. Restricted posts prompt their author to select the public audience in the existing edit sheet. Other people's audiences cannot be changed by sharing.

## Access and data

Migration `20261103081046_public_post_sharing.sql` was applied to production `rfayqekonkovfbkwjjum`. It adds only anonymous SELECT for `privacy = 'everyone' AND is_hidden = false`. Anonymous access is limited to the eight required post columns; moderation notes, location, and other internal columns are excluded. The handler uses the public API key and never forwards a visitor's session or uses a service-role key. Author display data comes from the existing public-safe profile RPC.

All responses are `no-store`. Deleted, restricted and hidden posts return the same 404 without content/metadata; backend failures return 503 with a retry action. Social platforms may retain previews already fetched in their own caches. Images use their public URL; video-only posts expose `og:video` with the Yamilook logo as the image fallback. Inline playback inside another platform is controlled by that platform.

The server function expects the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables at runtime. Vercel rewrites `/post/:id` before the SPA catch-all. Service workers exclude `/post` and `/api` from their cached navigation shell.

## Verification

- 9 Node integration tests cover HTML/metadata escaping, invalid IDs, private/hidden filtering, anonymous headers, HTTP error responses and actual Postgres RLS/column grants using PGlite.
- 29 focused UI/sharing tests pass, including native sharing, cancellation, clipboard fallback, canonical links and restricted posts.
- TypeScript and production build pass.
- Full Vitest run: 937 passed, 2 failures in pre-existing login validation text expectations; the same two failures were reproduced on unmodified main (63ecd5e).
- Production anonymous SQL read after migration: 57 public posts visible, zero non-public/hidden posts, internal moderation column inaccessible. The user's specified contacts-only post remained inaccessible until its separately authorized audience change.
- Anonymous HTTP requests against Supabase confirm public content is readable and the specified restricted post is blocked. Browser review verifies server-rendered public content without a session.

## Direct viewing mode

Shared links now open with the image/video before the author and caption, in a viewport-sized media stage. The first video requests inline autoplay while muted, with native play controls if the browser blocks autoplay. A visible sound toggle enables audio on a user gesture. Only the first item autoplays; other videos remain manually controlled. This applies to both server-rendered links and the SPA fallback, without requesting browser fullscreen automatically.
