# Angola: AFROLOC and NJILA entry points

Country AO displays the AFROLOC/NJILA card in ResidenceForm and the owner's ResidencePanel. Other countries and unset countries do not display it. Both buttons now enter /afroloc so the owner chooses an address before opening NJILA.

The entry-only phase is superseded by the account-bound temporary-address integration documented in [yamilook-afroloc-experience.md](./yamilook-afroloc-experience.md). The dedicated app.afroloc.ao/experiencia/yamilook/ interface uses the existing Yamilook account through allowlisted parent operations, without receiving passwords or session tokens. It does not change existing residence plans or certificates.

Backend migration and Edge Function were deployed on 2026-11-14. AFROLOC PR #8 and NJILA PR #32 were merged and published before Yamilook PR #212. The dedicated AFROLOC static entry is emitted by Vite to work on static hosting without rewrite configuration.

Automated database, protocol, UI, build and CI checks passed. The mobile-control suite passed on retry after an unrelated font-transition measurement failure. Production acceptance with a real signed-in account and device GPS (create, view the same point, sign out, sign back in and retrieve) remains pending and must not be inferred from synthetic tests.
