# Pre-registration language selection

The public welcome menu now offers the 13 ecosystem languages using native names without flags. The selector also appears on authentication pages and the onboarding header. Selection loads the language before switching, persists when browser storage is available, and preserves the current route and invitation query parameters. Arabic uses RTL through the existing document-language synchronization.

`src/i18n/entry-translations.ts` contains all eight strings used by the new welcome menu for every language. Existing authentication terminology is reused in that copy. The automated test verifies local resource presence without fallback; this is not linguistic certification.

## Review required

Kimbundu, Umbundu and Kikongo entry copy is provisional and requires review by competent native speakers. The other new translations also have not received independent human review. Do not claim validated linguistic quality.

The broader onboarding wizard still contains hardcoded Portuguese strings. Adding this selector does not translate its entire registration journey, legal documents, validation messages, or confirmation emails. These require a subsequent localization pass. Do not describe this PR as complete registration localization.

## Validation

- Three targeted tests: 13-language resource coverage, language switching/persistence/RTL/invitation preservation, existing registration redirect.
- Production build and focused ESLint checks.
