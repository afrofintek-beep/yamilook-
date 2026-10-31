# KOSOLOLA startup and call isolation

## Evidence and limits

The supplied 9.67-second screen recording repeatedly alternates between the calls history loader/statistics and the page-rendering error boundary. The separate 22.17-second recording contains an iOS Face ID/password flow; time spent in that native prompt is not a JavaScript startup measurement. No browser exception log or authenticated production trace was supplied. The exact exception in the first recording remains unconfirmed.

The existing boundary wraps the call provider. A descendant page exception therefore unmounts the provider and its transport, which can cancel pending call setup. The new route boundary sits inside the provider and resets on navigation. A regression test verifies that page failure, retry and navigation do not release the transport.

## Changes

- Precache the KOSOLOLA shell and its static dependencies, rather than recursively downloading every optional route and media module during service-worker installation. Cache optional public asset requests as they are used. Quota failures do not block successful network responses.
- Import the MediaPipe SDK only when segmentation or face effects are requested.
- Mount scheduling forms only when opened, including forms on scheduled-call cards.
- Keep history entries with missing/invalid dates visible under an unknown-date label instead of passing invalid dates to date-fns formatting. This is defensive hardening, not a claim that the supplied user's records contain invalid dates.
- Preserve the call provider during page errors and route loading.

## Comparable build results

Baseline: a248bc9b387cb350280ad83df40fd1580b46073d. Same lockfile and local Vite build procedure before/after.

| KOSOLOLA install precache | Before | After |
| --- | ---: | ---: |
| Files | 186 | 23 |
| Raw bytes | 2,639,487 | 1,052,014 |
| Sum of gzip-compressed file bytes | 824,613 | 331,113 |

About 60% less precache data and 88% fewer precache files. These figures describe the KOSOLOLA service-worker install list, not all application transfers or measured device startup time. The Yamilook service worker has a separate precache policy. An optional screen not yet visited may require a connection on first use; successfully requested assets are then cached for subsequent offline visits.

## Validation

77 tests across 18 suites passed (KOSOLOLA, direct-call transport, call components and scheduling). Production build and TypeScript no-emit checks passed. The added tests cover provider survival, invalid history dates, avoiding closed scheduling forms, on-demand route caching and cache quota failure.

Still required for production acceptance: comparable cold/warm startup measurements on the reporting iPhone, capture of the actual browser exception if it recurs, and real bidirectional voice/video between two devices. Automated tests use mocks and do not prove real device media connectivity.
