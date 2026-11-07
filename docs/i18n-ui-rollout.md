# Ten-language interface rollout — working draft

Status: **incomplete; do not merge or release**.

The public Academy screens were released separately in PR #188. This branch prepares the remaining interface localization and does not claim that the application is fully translated.

## Prepared

- Application-authored text in 264 source files now calls the interface translation namespace. Component subscriptions are placed before early returns; changing a language does not deliberately remount calls or forms.
- Module-level label objects use lazy getters so they do not freeze the language at import time.
- Existing translations are reused where the original phrase matches. Missing translations still fall back to existing source copy and are not counted as translated.
- Several explicit Portuguese date/number locales now follow the application language.
- `i18n-ui-translation-worklist.json` contains the exact 3,383 distinct source texts and requested languages for the next translation pass. It contains application copy only, not user messages, names, profile records, credentials or uploaded media.

## Required before release

1. Complete and review the ten language dictionaries. A local translation-model trial produced semantic errors and its generated text was rejected; none of it is in this branch.
2. Review extracted fragments and combine sentences with dynamic values into complete interpolation templates. Preserve variable names, numbers and product names.
3. Finish invitation templates, server-generated errors and system messages, static Academy copy/status tables, and remaining date-fns locale usage.
4. Review the source diff for technical labels, memoized values and any remaining untranslated application copy. Never translate user-authored content automatically.
5. Add regression checks for consent meaning, live language switching, Arabic layout, invitations and missing/empty translations; run the applicable full checks and browser flows before publication.

## Validation so far

- TypeScript application check passed.
- Public-language coverage, Academy communities, group creation and campaign-invitation component checks: 55 tests passed in four files.
- This is draft validation, not an end-to-end multilingual sign-off.
