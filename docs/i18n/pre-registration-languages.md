# Public entry in ten languages

The welcome screen, authentication screens, registration wizard and KOSOLOLA language selector offer exactly these languages: English, French, Portuguese, Arabic, Amharic, Swahili, Lingala, Yoruba, Shona and Zulu. Kimbundu, Umbundu and Kikongo are deferred at the user’s request; their existing resource files are retained, but their codes normalize to Portuguese and they are not exposed in selectors. Existing regional codes normalize to their supported base language. The ecosystem reference list remains intact.

The ten resource files contain all 183 keys across authentication, common commands, main navigation, public validation/social login messages and the registration wizard/residence form, plus eight welcome-menu strings per language. The wizard includes localized gender choices, birth date/month names, residence choices and notices, profile photo, biography, feature tour, invitation fields, consent labels and progress/resume messages. Language changes preserve the route, invitation parameters, wizard step and draft values. Known server error responses are presented through localized UI messages rather than raw service text. No database migration is involved.

Automated coverage verifies key presence without fallback and interpolation variables. Component tests cover all ten first-step renders, switching language midway through registration, invitation preservation, persistence, RTL, the deferred languages and residence choices. Geographic place names retain their existing proper names.

## Limits

This change localizes public entry and navigation, not the whole application. Feed, Academia, administration and other existing modules still contain untranslated text. Linked legal documents and confirmation emails are outside this change. Translation coverage is not linguistic certification: independent human review is recommended, particularly for Amharic, Lingala, Yoruba, Shona and Zulu. Do not claim the entire application is fully translated.

## Validation

- 35 targeted tests passed across six test files.
- Production build passed.
- TypeScript application check passed.
- ESLint passed on the changed React and language modules; existing repository-wide checks were not run.
