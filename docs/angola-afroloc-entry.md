# Angola: AFROLOC and NJILA entry points

Country AO displays an optional AFROLOC/NJILA card in ResidenceForm (onboarding and residence editing) and on the owner's ResidencePanel. Other countries and unset countries do not display it. Opening either service does not change the residence plan or transmit profile data, coordinates or sessions. Links use new windows and no referrer. Portuguese, English and French copy is included; other languages retain the Portuguese fallback.

This is an entry-point integration, not a completed temporary-address integration. It does not create addresses, import them, grant certification, share sessions or claim server-enforced expiry. The existing account-link activation dependencies remain applicable. The inspected AFROLOC_2026 tempAddress screen uses static examples; its relationship to app.afroloc.ao production has not been verified. Do not link directly to that screen as a working issuer.

Remaining: identify the production issuer/API, implement authorized temporary-address creation and retrieval with expiry/revocation, validate NJILA resolution under the same permissions, and test two accounts end to end. No production database changes are included.
