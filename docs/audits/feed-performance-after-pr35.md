# Feed performance follow-up to PRs 34/35

Baseline: main 5590a3a, retrieved during the 26 October 2026 request. Latest main already includes PR 37; this is not an isolated deployment of PR 35.

## Production observations and limits

Opening https://yamilook.com/muxi in the cloud Chrome browser redirected to https://www.yamilook.com/welcome. There was no authenticated session. No production feed posts, authenticated request waterfall, image transfer sizes, first-post timing, LCP, or mobile-network measurements could be captured. Browser performance entries were unavailable through the browser inspection API.

Two independent curl requests to https://www.yamilook.com/muxi returned HTTP 200 and 3431 bytes of HTML:

| Sample | TTFB | Total |
| --- | --- | --- |
| 1 | 5.682253 s | 5.725437 s |
| 2 | 7.771504 s | 7.771566 s |

These are real HTTP observations from the execution environment, including its network/proxy path. They are **not** browser rendering times, device measurements, mobile-network results, or evidence of server-origin latency. Two samples do not establish representative production performance.

## Confirmed existing fixes

PostCard, CommentsSheet and CreatePostSheet use autoLoad:false. Feed derives organic cards immediately, independently of advertisements. A controlled browser test confirms cards remain visible with advertisement requests held pending.

## Reproduced remaining waste and fix

Feed called usePosts with default discovery loading enabled. In addition to its 20-post feed query it requested up to 50 discovery posts sorted by likes_count and enriched them with profiles, reactions, saves and topics. Feed never uses those results. Realtime events could also repeat discovery requests.

Add an opt-out loadDiscovery option (default true for existing callers), used only by Feed. Apply it to initial discovery/topics fetches and realtime discovery refreshes. Feed refresh, pagination, realtime subscription and discovery screens retain their existing behavior. No CSS, permissions or database schema changed.

Regression proof: running the tightened request-count test against Feed without the opt-out failed with 4 collection requests (expected <=2). With the opt-out it passes with 2, and zero likes_count discovery queries. This is React StrictMode development behavior with 12 synthetic posts, not a production speedup measurement.

## Validation

- 27 targeted Vitest tests passed (Feed, usePosts profile, MediaCarousel).
- Five Playwright tests passed using local Chromium: nine viewport/orientation steps from 320 to 1920 px, request bound, pending advertising, and pagination at 390/1440 px.
- Pagination fixtures load 20 cards, append five, stop requesting at the final page and keep the last card reachable. This does not cover every production edge case (timestamp ties, errors or realtime/refresh races).
- Mobile 320px and desktop 1440px screenshots inspected; navigation, column width and rail visibility retain PR34 behavior. Emulation is not a real iPhone/Safari check.
- Production build passed. Targeted ESLint: no errors, six existing callback-dependency warnings in usePosts.

## Images and further candidates

MediaCarousel uses eager/high priority for the first image of the priority post; other images are lazy and asynchronously decoded. Videos outside the visible active item use preload:none. Existing media regression tests pass. Image URLs are used directly with no srcset/sizes in this component; transfer cost of original uploads remains unmeasured. If a text post comes first, subsequent photo posts have no explicit high priority. These are candidates for measurement, not demonstrated production bottlenecks.

Post enrichment still awaits profiles, all reactions, post-topic mappings and personal reactions/saves in several sequential stages before showing cards. Advertising refetches when feedPosts changes; its late insertion can move content. Actual impact is unmeasured, so this PR avoids speculative changes to those flows.

## Remaining input

An authenticated production session is required to measure navigation-to-first-visible-post and first-image display, capture actual API/image timings, verify advertising insertion and scroll behavior with real data, and compare cold/warm mobile and desktop sessions. Real iPhone/Safari and local mobile-network validation remain outstanding.

## Authenticated production follow-up

The user completed browserAuth on their own account. Fresh visible evidence confirmed https://www.yamilook.com/feed with real publications. Desktop viewport: 1363 x 936 CSS pixels, document scrollWidth 1363 (no horizontal overflow). Sidebar and lateral navigation visually retained the PR34 layout.

| Sample | Reload to first visible article, upper bound |
| --- | --- |
| 1 | 2459 ms |
| 2 | 2309 ms |

Method: controller wall clock immediately before tab.reload(), stopped after the first article locator became visible. These are repeat authenticated reloads with cache state uncontrolled, including browser RPC/automation overhead. They are not Navigation Timing/LCP/first-paint measurements, cold-cache benchmarks, or device/network measurements. On sample 2, the first eager image was complete with naturalWidth 1600 and displayWidth 672 when inspected immediately after article visibility. No exact image completion timestamp was captured.

Organic cards were observed before the sponsored card appeared in the refreshed feed. This agrees with the controlled pending-ad test, but provides no measured ad response duration. Scrolling using the viewport End key appended real cards: article count rose from 16 to 54 across subsequent observations. This demonstrates continuation, not final-page or no-duplicates verification. Remaining lazy images had not all loaded when inspected; that alone is not an image failure.

Several profile avatars had naturalWidth 2316 while displayed at 40 CSS pixels. This is evidence of oversized source dimensions, not a measurement of transfer bytes or proof of the main latency cause. Consider thumbnail variants after confirming storage/CDN capabilities and actual transfer costs.

The browser API still does not expose a network waterfall or Performance entries, and offers no supported viewport-resize control here. Actual request counts/durations, cold/warm cache comparison, mobile production timings and real iPhone/Safari behavior remain unverified. Earlier unauthenticated limitations above describe the initial stage; authenticated desktop observations in this section supersede that blocker only.

## Production API and storage log analysis for iOS clients

Window: 26 October 2026, 09:35:08–17:20:00 UTC (10:35:08–18:20:00 Africa/Luanda). Source: Supabase project rfayqekonkovfbkwjjum unified edge_logs, queried read-only. This is a retrospective production sample, not a newly executed physical-device test. Clients are classified by User-Agent containing iPhone/iPad. User-Agent is not proof of physical hardware. The shared backend also serves KOSOLOLA and other screens, so totals cannot be attributed to feed alone. No feed/muxi path was present in the Referer field of the selected endpoint records.

### iOS GET requests

| Endpoint | Count | HTTP >=400 | Mean response.origin_time | p95 response.origin_time |
| --- | ---: | ---: | ---: | ---: |
| posts | 642 | 0 | 210.99 | 378.85 |
| contacts | 857 | 0 | 210.57 | 469.20 |
| post_likes | 1222 | 0 | 174.07 | 192.00 |
| post_topics | 611 | 0 | 175.79 | 197.00 |
| saved_posts | 596 | 0 | 173.08 | 190.00 |
| discover_topics | 567 | 0 | 203.60 | 435.50 |
| advertisements | 83 | 0 | 188.28 | 218.50 |

Timing values are the server-log response.origin_time field, conventionally in milliseconds; they do not include device rendering or establish the client's full network round trip. Do not add per-endpoint means or percentiles to estimate a page load. These aggregates mix separate requests and sessions.

Of the 642 iOS post GETs, 307 had likes_count in request.search (discovery-shaped), four had a created_at less-than cursor (pagination-shaped), and 331 were other post-query shapes. No full search strings, identifiers, tokens or individual content were exported. The discovery counts confirm real use of that query shape in production, but do not attribute every request to Feed. The code reproduction in PR38 remains the evidence for unnecessary discovery work on Feed.

The public-profile batch RPC also had 635 iOS POST calls, without HTTP >=400 errors in the selected endpoint group. Across all devices, that RPC's mean response.origin_time was 174.07 and p95 195.85.

### Storage responses for iOS clients

| URL extension category | GETs | HTTP >=400 | Content-Length present | Sum of declared Content-Length | Largest declared response |
| --- | ---: | ---: | ---: | ---: | ---: |
| Images (jpg/jpeg/png/webp/avif/heic) | 825 | 0 | 714 | 1,332,183,381 bytes | 6,678,136 bytes |
| Videos (mov/mp4/webm) | 533 | 0 | 451 | 2,300,338,793 bytes | 84,621,710 bytes |
| Other media | 43 | 1 | 43 | 1,561,571 bytes | 73,427 bytes |

These are response header declarations across the whole window and shared backend, including repeated/range requests where applicable. They are not measured bytes actually downloaded by devices, unique file sizes, per-session consumption or first-load payload. Missing length headers and interrupted transfers prevent that inference. Media requests with no matching extension can fall into Other media.

Heavy original media is a measured optimization candidate, consistent with the oversized avatar dimensions observed in desktop production. It is not yet a proven cause of the mobile first-post delay. The current feed video component auto-plays visible active videos and pauses others; logs alone cannot attribute a transfer to playback versus metadata.

### Remaining limits and next capture

Vercel's Web Analytics query returned web_analytics_not_enabled. The repository has no Speed Insights/web-vitals or custom browser performance instrumentation. The exposed observability schema lists Speed Insights metrics, but this does not imply this project has collected them; an attempted legacy LCP query returned HTTP 400 and produced no results. No Speed Insights values are claimed.

There is still no connected physical mobile device or captured mobile browser waterfall. To finish the exact requested on-device measurement, collect a browser trace/HAR from an actual iPhone/Android session, or instrument an opt-in diagnostic screen on the deployed app to record navigation/first-post/first-image timestamps and sanitized Resource Timing. This should exclude request bodies, authentication headers, full signed URLs and personal content. Real session evidence is required before declaring the mobile performance check complete.

### Reproducible query shape

Use query_logs with the explicit window above; classify iOS using match(log_attributes['request.headers.user_agent'], 'iPhone|iPad'). Filter source='edge_logs' and request.method='GET'. Group API aggregates by allowlisted request.path and read response.status_code, response.origin_time and response.headers.content_length. Classify discovery and pagination through predicates on request.search; do not output that field. Group storage requests by file extension category; do not export full object paths. No database/schema or application changes were made in this log-analysis follow-up.
