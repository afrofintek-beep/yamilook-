# Yamilook account-bound AFROLOC experience

Entry: /afroloc for Angola profiles. An unauthenticated visit returns to this route after password or phone login. The existing Yamilook session is the sole account credential. The app.afroloc.ao/experiencia/yamilook/ child only sends allowlisted operations; it never receives passwords or access/refresh tokens. The parent checks exact window and origin and calls the afroloc-experience Edge Function. The function verifies the user with Supabase Auth, then the database checks the live session and ownership on every operation.

Temporary records live in afroloc_experience_addresses, independently of existing profiles, official certificates and event records. RLS denies direct reads/writes; the constrained RPC permits only the current owner and existing moderator/admin reviewers. Expiry is 30 days; maximum three live addresses. Idempotent creation, owner isolation, manual review, self-review refusal, closing and audit are enforced server-side. No existing residential address is migrated or changed.

The generator uses the official administrative catalog and the canonical Angola auto-zone grid selection. The owner map receives the original saved coordinates with a 30-second lease through the exact trusted app parent, renewed under the owner's Yamilook session. NJILA purpose=owner is a separate embedded owner view; it does not use public lookup or grant certification. No private coordinates, credentials or address IDs are placed in navigation URLs. Offline, hidden, expired and closed views clear the marker. This is owner consultation, not a new third-party sharing grant or official certificate.

Source is coordinated across yamilook-, AFROLOC_2026 (feat/witness-identity-sms-review production branch) and njila. Publish backend, NJILA and AFROLOC before the Yamilook entry links. Keep the existing event route independent.

Validation: PGlite database integration fixtures use synthetic accounts only; UI/protocol tests and builds. A real authenticated production create/logout/login/map check remains a separate acceptance check and must not be reported as completed from mocks alone.
