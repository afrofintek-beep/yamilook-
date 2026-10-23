# Residence declaration and validation

The onboarding Banda step offers home capture, away declaration, existing AFROLOC code and deferred confirmation. No GPS is requested automatically. Away/deferred choices never submit coordinates. GPS and codes are not saved in browser onboarding drafts; the selected method is preserved and capture/re-entry is required on resume.

`submit_residence_declaration` is authenticated and always targets auth.uid(). It records a private declaration, assigns the declared Banda subject to the existing change cooldown, and sets AFROLOC certification to pending for capture/code or none for deferred declarations. A code is a claim, not proof of usage rights. Existing authority/partner verification remains responsible for certification. Admin reviewers must validate the user/address association before approving.

The profile has a “Validar a minha Banda” entry to complete or update the declaration later. User-facing participation badges distinguish activity/presence from residence certification. Check-ins record presence without updating the residence address.

`can_receive_banda_benefits` requires an active Banda, certified address and a matching declaration when present. Existing certified accounts without a new declaration remain eligible. Changing the address invalidates its previous certificate. Positive Kumbu awards tagged `banda`, `territorial` or `banda_bonus` are rejected server-side until eligible. General activity rewards retain their existing rules; this change does not invent new reward campaigns or physical-presence bonus thresholds.

`residence_declarations` is readable only by its owner and authorized moderators/admins, with writes restricted to the RPC. It is not part of public profile views. Precise address input must not be used as a public location.

Validation: frontend form/API/draft tests, production build, and `supabase/tests/residence_declarations.sql` (transaction rolled back). SQL checks private access, self-certification denial, pending capture/code, preserving Banda tenure, certification eligibility and territorial-award enforcement. End-to-end signup with email delivery and physical GPS still needs device validation.
