# Angola residence hierarchy

The Angola signup/profile flow separates province, municipality, commune (where applicable), local neighborhood and optional address complement. City remains supplementary legacy/community information. The shared AFROLOC catalog contains 21 provinces, 326 municipalities and 378 communes; the signup snapshot allows use before authentication. The app.afroloc.ao Yamilook experience uses the same database catalog. NJILA continues to receive the original stored coordinates via the existing owner bridge.

Source: Lei 14/24 (5 September 2024), https://c2a.portais.gov.ao/uploads/LEI_14_24_5_de_SETEMBRO_LEI_DA_DPA_043a0de85f.pdf . Snapshot version AO-2026-11-14. IDs such as AO-LDA-TALATONA are the existing AFROLOC internal identifiers, not the numeric CNUT identifiers of Lei 8/25. Do not silently change issued codes to a different coding scheme. Catalog changes require a versioned, reviewed update of the shared database and signup snapshot.

An imported eight-part code pre-fills only an unambiguous hierarchy; it never invents a neighborhood, follows a QR URL or uploads the card image. The backend rejects mismatched administrative code prefixes. Legacy codes can still be declared with a manually selected hierarchy and remain pending review. No municipalities are assigned fake communes. New addresses without communes use the explicit 000 segment; old codes are unchanged.

Administrative metadata is stored in residence_declarations under existing owner/moderator RLS. The public submission wrapper is SECURITY INVOKER and delegates to a private checked function; there is no caller-supplied user ID or certification state. Existing Banda cooldown enforcement remains. Reclassifying the same saved address preserves its coordinates and code. Older-client residence changes clear stale metadata. No data backfill rewrites profiles.

A code-consistent hierarchy is not a verified geographic boundary or residence certificate. No authoritative polygon layer is loaded by this change: point-in-polygon checking stays pending and the interface states this explicitly. Existing owner-map point forwarding is unchanged. Real-device authenticated GPS/map acceptance was not performed by these automated tests.

Validation: complete catalog/parent checks; dependent selection reset; ten enabled UI languages; unambiguous import and code mismatch; isolated PGlite checks for owner isolation, no-commune creation, preserved coordinates/codes, pending certification and cooldown refusal. TypeScript and production builds for Yamilook and the AFROLOC experience.
