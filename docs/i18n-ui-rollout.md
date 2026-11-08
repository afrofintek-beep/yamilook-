# Ten-language interface rollout

The public Academy presentation and its real application captures were released in PR #188. This change extends localization across the application flows behind those screens.

## Languages and coverage

Portuguese, English, French, Arabic, Amharic, Swahili, Lingala, Yoruba, Shona and Zulu (`pt`, `en`, `fr`, `ar`, `am`, `sw`, `ln`, `yo`, `sn`, `zu`). Each interface dictionary contains 3,435 fixed source phrases. The existing translation namespace has 1,041 keys in each language; 4,568 missing locale entries were filled across the ten dictionaries.

Covered areas include Academy sessions, learning paths and mentoring; chat, contacts, groups and message tools; calls, recording notices and consent; profiles, feed and sharing; invitations and campaign participation; calendar labels, relative dates and recovery screens. KOSOLOLA login copy now supports all ten languages. Server invitation templates follow the sender's selected language and preserve it in the registration link.

## Implementation and data boundaries

- The interface namespace loads with the selected language. Changing languages updates subscribed components without deliberately remounting forms, calls or media. Arabic sets the document direction to RTL.
- Dynamic names, amounts, dates and codes are interpolated locally into complete sentence templates. User posts, messages, biographies and media are not translated.
- Translation was performed at build time using Google Translate on authorized fixed application copy. English and Portuguese source phrases were handled separately in the final review. Reviewed overrides cover ambiguous controls, recording consent/refusal/retention and relative-time fallbacks.
- There are no runtime translation API calls. No recipient addresses, names, invitation codes, user content or credentials were sent to the translation provider.
- Known server errors use an explicit allowlist; unrecognized server details use a generic translated fallback. Developer invariant errors retain their original identifiers.
- Invitation email HTML escapes interpolated text and URLs. JWT verification, authentication, recipient ownership checks, campaign eligibility, idempotency and existing database policies are preserved. No database migration is required.
- Other languages load lazily. Startup recovery uses a small synchronous dictionary independent of authentication and the main translation loader.

## Validation

`npm test -- --maxWorkers=3`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build` validate the change. The dedicated interface workflow runs these checks on future translation changes.

Coverage tests require an entry for every literal UI source and reject runtime values passed to `uiText`. They also check all ten dictionaries, existing keys, placeholders, Arabic direction, actual calendar captions and navigation, form state preservation, localized invitation links and escaped email templates. Recording tests exercise consent and refusal in every language. React hook ordering was checked across the changed components.

## Limits and release

This is machine-assisted localization with targeted semantic review, not native-speaker certification of every phrase. Internal administration reports, printable manuals, technical diagnostics and provider-owned browser/device dialogs are not a claim of complete ten-language coverage. User-authored content and database-authored titles remain in their original language.

The frontend is deployed through the repository's existing Vercel integration. Deploy `send-user-invitation` and `send-mvp-candidate-invitation` with the shared invitation files and `verify_jwt: true`. Confirm the deployment commit and smoke-test the public language flows after release; do not send real invitation emails as a test.
