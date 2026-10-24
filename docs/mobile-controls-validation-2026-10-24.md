# Mobile controls validation — 24 October 2026

Base: `0dd0019` on `main`. PR #5's opaque Apple status-bar metadata is present in both source and production HTML entries. This work retains it.

## Reproduced defects and corrections

- At 320 × 568, a long contact name pushed a chat control's right edge to 353.4 px, outside the viewport. The contact section now shrinks and truncates while the back and action controls keep their width. Back has an accessible name.
- In landscape with a simulated 59 px right inset, the media close control extended to 794 px, beyond the safe edge of 785 px. The dialog now uses the width and centre of the safe rectangle, including asymmetric left/right and top/bottom insets.
- Conversation-list, chat and Yamilook feed headers now reserve left/right safe areas in addition to their existing top inset.

## Evidence

26 distinct WebKit browser scenarios passed locally: the main 24-case suite, followed by the two added feed cases and rechecks of the two reproduced regressions. The two regression cases also failed against the original source and passed after restoration of the correction.

| Surface | Checks |
| --- | --- |
| Yamilook conversations and KOSOLOLA entry | Real entry HTML status-bar metadata; list and chat button bounds; hit testing of chat button centres; long contact name; clicking Back returns to the conversation list |
| Shared production media dialog | Safe bounds of Close; clicking Close dismisses; reopen and Escape dismisses |
| Yamilook feed | Left/right header button bounds in both landscape notch positions |

Dimensions: 320 × 568, 375 × 667, 390 × 844, 568 × 320, 1024 × 768, 844 × 390. Tests include zero insets, portrait top/bottom insets of 59/34 px and landscape left or right inset of 59 px with bottom inset of 21 px.

Production build and six existing video presentation unit tests passed. Focused ESLint returned no errors (one Fast Refresh warning for the browser fixture). No application data, accounts, API policies or database schema were changed.

## Method and limits

The browser tests use actual application components with intercepted, synthetic account and conversation API responses. The separate KOSOLOLA document navigation reproduces the existing Vercel rewrite to its own HTML entry. The media geometry fixture uses image mode of the production dialog; native video decoding is not covered by these browser cases. Its video close/pause handling is covered by the existing unit tests, not by real media playback.

Linux WebKit does not provide iOS's status bar, notch or Home Screen installation. Tests substitute the safe-area env() values in declarations of the actual loaded stylesheets; they are geometry regression tests, not evidence that iOS supplies those values or honours the metadata. The remote public site opened without an authenticated session, so live authenticated navigation was not verified.

Browser downloads and host dependency installation required a local environment workaround: WebKit was downloaded from the official fallback CDN, missing Ubuntu libraries were extracted into its local bundle, and the host-dependency preflight was skipped after resolving the actual runtime libraries. This does not change application code or test assertions. The committed CI job uses the normal `playwright install --with-deps webkit` route.

## Remaining physical iPhone confirmation

Check both apps in Safari and after opening from the Home Screen, including an existing installation and a fresh installation. Verify that the status bar stays outside the interactive header, rotate where permitted by the OS/manifest, open and close real image/video media, use Back, and repeat with the keyboard open and browser toolbars expanded/collapsed. Both manifests request portrait orientation; forced landscape emulation is a stress test, not evidence that an installed app will rotate.

No physical iPhone was available. Do not mark the iOS overlap issue as device-confirmed solely from these results.

## Run

```sh
npm ci
npx playwright install --with-deps webkit
npx playwright test -c playwright.mobile.config.ts
npx vitest run src/components/chat/MediaPreview.test.tsx
npm run build
```
