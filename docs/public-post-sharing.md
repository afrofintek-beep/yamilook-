# Public post sharing

The feed used to copy `/post/:id` links even though no route existed. The posts SELECT policy also excluded anonymous readers. Public posts now have a server-rendered page on the same canonical URL, with complete text, image/video controls and Open Graph/Twitter metadata. Viewing needs neither login nor JavaScript. The React fallback covers navigation within the app and old service workers; direct public routes skip authenticated providers.

The share button opens a destination picker with KOSOLOLA first, followed by WhatsApp, Facebook, LinkedIn, X, the native device sharing sheet and copy link. The copy-link menu still copies directly. Both use `https://www.yamilook.com`, including when the app runs on a preview or alternate domain. Restricted posts prompt their author to select the public audience in the existing edit sheet. Other people's audiences cannot be changed by sharing.

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

## KOSOLOLA destinations

KOSOLOLA opens `/papos-app/share/post/:postId`; the existing authentication gate preserves this destination through login. Users search contacts and existing conversations (including groups), select one recipient and explicitly send. Blocked contacts are excluded. Selecting a recipient does not create a conversation or send anything. The post is checked again for public visibility before sending. Existing message RLS enforces sender identity and conversation membership.

Messages contain only the canonical public link, using a stable message UUID across retries to avoid duplicate delivery after a lost acknowledgement. Chat renders exact canonical post links as previews fetched anonymously, without storing author/media snapshots. Opening the card leads to the public viewer. Non-public content is unavailable; external platform previews remain subject to their caches.

Focused tests cover recipient selection, contact creation on confirmation, visibility revalidation, retry identity and server errors. External destination tests cover canonical links, spoofed URL rejection and server-rendered destination order. No real messages are sent by automated tests.

## Site icon

The public viewer explicitly declares the Yamilook PNG favicon and Apple touch icon. The root `/favicon.ico` also packages that same PNG, replacing the inherited Lovable asset for clients that request the conventional path. That path requests cache revalidation; previews already stored by external platforms may retain their previous icon.

## Video file sharing

The chooser separates file sharing from link sharing. For public videos, users select a video and explicitly prepare its file; a second tap invokes Web Share with `files` only, preserving mobile transient activation and avoiding apps treating the payload as a link. Native share success means handoff to an app, not confirmation of publication. Unsupported browsers and failures retain a download action; LinkedIn availability is determined by the installed app and OS.

`GET /api/public-post?id=…&media=video&index=…` returns the selected public video descriptor using the same anonymous visibility checks as the viewer. `download=1` rechecks visibility and redirects to the existing media URL with Storage's download filename hint. No binary data is proxied through Vercel, no credentials are forwarded to media hosts, and no storage policies change. Previously downloaded copies cannot be revoked.

Preparation streams at most 100 MiB into memory, reports progress, supports cancellation and times out after two minutes. Larger files use the direct download path. Visibility and the media URL are rechecked after transfer. Closing the chooser or changing video cancels the transfer and releases the prepared file. Shared browser helpers are emitted from one source file by the Vite plugin; the SSR viewer and React dialog use the same preparation and native sharing logic.

## Public author profile links

Legacy usernames could contain trailing spaces while public post links already trimmed them. The exact username comparison in `get_public_profile` therefore returned null for an existing author. Migration `20261103103824_normalize_public_profile_lookup.sql` trims both sides of the case-insensitive lookup and returns a clean username. A matching unique index prevents ambiguous handles; the production preflight found no normalized collisions. Existing profile rows, public field projection, function grants and RLS policies remain unchanged.

Profile edits trim usernames before saving, and shared profile URLs trim and encode the handle. The public profile page distinguishes a successful empty result from a loading failure, offers retry, and cancels stale or timed-out requests. Verification: one PostgreSQL integration test covers legacy links, canonical uniqueness and anonymous data boundaries; 33 focused UI/auth tests, TypeScript and the production build pass. The production anonymous lookup and browser both resolve the affected AFIS author's clean profile URL. Supabase advisors show no new findings after the migration.

## Sending an author's own files without making a post public

The feed share button and restricted owner's menu now open a file chooser for every audience: everyone, contacts, close friends and only me. The chooser displays the existing audience and never updates it. It prepares one selected photo/video and, on a separate tap, opens the native sharing sheet with only the File. Recipients are selected in the destination app. Native handoff success is recorded using the existing post_shares operation; it does not confirm that a message was sent. Copies may be saved or forwarded by recipients. Text-only posts have no file export.

The `owned-post-media` Edge Function validates the caller through Auth, checks the active session through `account_current_session_id`, and queries posts with the caller's JWT plus explicit owner and moderation filters. Gateway JWT verification is replaced by these in-function checks so the endpoint does not depend on the gateway's signing-key support. No service-role credentials, new public access grants, database writes, media copies, signed links or storage policy changes are used. Only an existing photo/video URL in this project's public media bucket is returned to the authenticated author. The original bucket model remains unchanged; this feature does not convert existing media URLs into private storage.

Preparation is bounded to 100 MiB and two minutes, supports cancellation, and rechecks the session, ownership and selected media after transfer. Closing the menu or changing media discards preparation. For unsupported devices or large files, an authenticated download preparation offers a fresh-tap save link; that control clears after 30 seconds (the existing storage URL itself is not revoked). Public link sharing remains limited to public posts; another person's restricted post cannot be exported through this endpoint.

Validation: 31 Node tests cover the public and owner endpoints, denial boundaries, file transfer and cancellation; 50 focused UI/sharing tests cover all restricted audiences, owner-only controls, download fallback, timeouts and existing public/KOSOLOLA sharing. TypeScript and the production build pass. Production RLS verification confirms the author can read their restricted posts while anonymous readers cannot read any restricted or hidden post. No real messages are sent during testing.
