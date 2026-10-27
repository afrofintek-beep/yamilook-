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
