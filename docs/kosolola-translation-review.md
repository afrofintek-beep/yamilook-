# KOSOLOLA translation review — 1 November 2026

Status: incomplete draft, not deployed. This change is the first settings batch, not full localization of KOSOLOLA.

The selector already supports 13 languages, including Kikongo below the screenshot. Existing Arabic document direction handling is unchanged.

## Implemented

Settings headings, privacy labels, navigation actions and main ringtone controls now use i18next. Added 21 KOSOLOLA keys in Portuguese, English, French, Arabic, Amharic, Swahili, Lingala, Yoruba, Shona and Zulu; added seven shared settings keys to Yoruba, Shona and Zulu. The incomplete-translation notice and language-load error are localized.

All new non-Portuguese text is a machine-assisted draft requiring linguistic review. Existing Kimbundu, Umbundu and Kikongo dictionaries are preserved; new strings fall back to Portuguese. They must not be presented as complete or certified translations. No speculative new Kimbundu/Umbundu translations were inserted.

## Outstanding before full release

- Native review of new strings, particularly African-language terminology; approved Kimbundu, Umbundu and Kikongo equivalents for the new keys.
- Translate remaining literal text in brand slogan, ringtone help/errors, security disclosures, push settings, devices, profile, login, installation, archive/block sheets, chat and call components.
- Fill missing shared keys in the companion JSON. Its Portuguese source strings form the reviewer worklist; missing entries are explicitly not translations. This inventory covers locale keys, not every literal in components.
- Translate ringtone pattern names where existing dictionaries lack them.
- Test actual screens for all 13 languages, long labels and Arabic RTL; validate on mobile.

## Validation

10 existing tests passed across language selection (including persistence and Arabic direction), sign-out and ringtone settings. Production build result recorded in the pull request.

## Follow-up batch 2 — 1 November 2026

This batch builds on PR #98 without replacing any existing locale entry. It adds 69 KOSOLOLA keys in Portuguese, English, French and Arabic, fills the 25 English shared-key gaps listed in the original inventory, and adds the five missing ringtone pattern names in French and Arabic.

Converted components: `PaposSettings`, `CallRingtoneSettings`, `CallPushSettings`, `ConnectedDevices`, `PaposProfile`, and `PaposInstall`. This covers security and sign-out disclosures, ringtone errors/help, push permission and installation guidance, device revocation, profile actions and app installation. User names and profile content remain user content, not translation inputs.

Persistent error/status messages are translated at render time. Switching language updates an existing error without retrying an operation. Known push service messages are adapted to keys at the UI boundary, leaving permission requests and service behavior unchanged; unrecognized errors show a translated generic message. Device names use bidirectional isolation, dates use the selected locale, and alert/installation buttons wrap long labels.

### Linguistic status

`kosolola-i18n-batch-2.json` is the explicit review manifest. Portuguese is the source. All added English, French and Arabic translations are **provisional**, with no linguistic approval recorded (`approved_translations: []`). Reviewers must record language, keys, reviewer and approval date before describing any of these as approved. Security, permissions and session-revocation disclosures especially require meaning-preserving review.

Kimbundu, Umbundu and Kikongo dictionaries are unchanged. No speculative proposals were inserted or represented as translations. Their missing expressions, and missing expressions in Amharic, Swahili, Lingala, Yoruba, Shona and Zulu, remain in the existing JSON worklist with `awaiting_specialist_translation_fallback_only`. Existing fallback behavior and the incomplete-language notice remain available. A fallback is not a translation or a linguistic approval.

### Release boundary

The component extraction, preserved Portuguese source, fallback behavior and responsive improvements can be considered as an incremental technical release after CI and browser checks pass. The non-Portuguese additions may only be described as provisional translations, not a completed or linguistically certified 13-language release. This PR does not deploy or merge itself and requires no database migration.

Still outstanding: native review; untranslated brand slogan variants; login literals; archive and block sheets; chat composer, message menus and call-screen literals. This batch translates profile call actions and call-alert settings, not the whole voice/video call interface. The original shared-key inventory is refreshed rather than treated as a complete scan of all component literals.

### Verification

The added tests cover all 13 selector choices with mounted ringtone/push controls, preference persistence, Arabic RTL and return to LTR, retranslation of existing errors, device-revocation interpolation/target preservation, installation instructions, and interpolation parity across the added translations. Browser tests cover login and settings at 320/390 px, all 13 login choices, real reload persistence, and horizontal/button overflow checks.

Final local results for this batch:

- `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=test-only npm test`: **135 files, 844 tests passed**. The first unconfigured run had three import failures due to the missing synthetic URL; the configured run passed.
- `npx playwright test -c playwright.mobile.config.ts papos-languages.spec.ts kosolola-settings-i18n.spec.ts`: **4 passed**, WebKit/iPhone emulation at 320 and 390 px. This environment required temporary extracted WebKit libraries and a local launcher library-path adjustment; the repository CI uses `playwright install --with-deps webkit`. No physical iPhone validation is claimed.
- `npx tsc --noEmit -p tsconfig.app.json`: passed.
- `npm run build`: passed (existing large-chunk warning).
- ESLint on changed components/helpers/tests: zero errors; two pre-existing effect-dependency warnings in `CallPushSettings` remain.
- Compared every existing entry in PT/EN/FR/AR/KMB/UMB/KG against the base commit: all preserved. `git diff --check` passed.

No production data, real notification subscriptions, real device sessions or call transports were changed during validation; browser API responses were synthetic. Hosted CI must still be checked before merging.
