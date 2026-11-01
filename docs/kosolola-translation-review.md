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
