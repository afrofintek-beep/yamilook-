# Trusted invitations

## User experience

Administrators open `/admin#convites-confianca` to issue an individual invitation.
The default activation deadline is 72 hours; the interface also offers 24 hours
and seven days. The invitation activates one ordinary account and grants no
administration, business verification, address certification or payment privilege.

The administrator copies a personal link, copies a translated message, displays
the individual QR, or opens WhatsApp to share manually. The app does not send
invitation messages automatically. Invitation links contain the bearer secret
in a URL fragment. Store it when issued: the database retains only its SHA-256
hash and cannot display the original link again. An unused invitation can be
cancelled; cancelling an invitation does not suspend an activated account.

The recipient chooses a display name, a username and their own password, accepts
the terms, and receives a native Supabase session. They must save the one-time
recovery code before continuing with the existing required profile setup.
Opening a link, rendering a preview or scanning its QR never consumes it.

Both Yamilook and KOSOLOLA accept the username on their existing login form.
The ordinary email/password path remains native Supabase authentication. The
forgot-password screen offers email recovery and recovery with the saved code.
Recovery codes rotate when used. A lost activation/recovery response may mean
the user does not receive the latest recovery code: the chosen password still
provides access; administrative recovery must independently verify the person.
There is no automatic recovery from an unverified email or a forwarded invitation.

## Identity and authorisation

Admission by an administrator is recorded separately from proof of contact
ownership. The new flow does not collect a real email address. Its internal
Auth login identifier is a random value at the non-deliverable domain
`trusted-login.yamilook.invalid`. This identifier is an adapter for native Auth
passwords and sessions, not a contact mailbox. `profiles.email` is null and
server-owned metadata records `contact_email_verified: false`.

Login and recovery resolve the current profile username in a private account
mapping. They never claim, overwrite or merge an existing account on the basis
of an entered email. Real email verification and future identity linking must
use a separate, verified linking flow; do not convert the internal identifier
into a verified real mailbox administratively.

The old actual-email `admin_waiver` option is removed from the issuance UI.
Previously issued invitations and accounts are not migrated by this change.

The service verifies a user's signed token and active Auth session before any
administrative operation. The database rechecks the administrator's role,
deletion and ban state. Issuance, previews, cancellation, activation and recovery
use the `trusted-invitations` Edge Function; the underlying public RPC is callable
only by the service role and delegates to private functions. Private tables have
RLS enabled and no browser grants. Invitation consumption and account provenance
commit inside the Auth user creation transaction, using a private reservation.

Before calling native Auth, the service generates a new UUID, an internal alias
and a recovery code. A service-only RPC reserves that UUID, alias, username and
recovery-code hash for at most two minutes. Phone mode also binds the verified
OTP challenge ID. The `BEFORE INSERT` trigger locks the reservation, rechecks
expiry, revocation, administrator eligibility and phone proof, and consumes the
invitation only for the exact reserved identity. It then writes permanent
provenance and confirms the internal login identifier. The bearer token and
recovery code never enter Auth metadata; their hashes remain private.

This order follows [GoTrue v2.198.0 adminUserCreate](https://github.com/supabase/auth/blob/v2.198.0/internal/api/admin.go),
which inserts the user before applying custom app metadata and confirmation
flags. The Edge Function therefore supplies the reserved UUID and omits custom
`app_metadata`, preserving the permanent metadata written by the trigger.
The selected language is included in user metadata because native confirmation
rewrites that metadata from its original user model.

Trusted accounts must retain a username that login and recovery can represent:
3–20 letters, digits or underscores, beginning with a letter or digit. The
database applies this rule when a trusted account changes its username and
uses the normalized current value for subsequent access. Ordinary accounts
retain their existing username rules.

## SMS mode

Phone invitations are bound to the administrator's stored E.164 number. A code
is valid for five minutes, with a 60-second resend interval, bounded attempts,
and invitation/account/IP limits. Codes are hashed with a domain-separated HMAC;
an accepted provider request is required before the challenge can be used.
The number is added as a confirmed Auth phone only after a correct challenge.
Direct invitations do not mark a telephone number as verified.

The backend reports `sms_ready` only when all of these existing environment
settings are configured: `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_SENDER`
and `ACCOUNT_PHONE_OTP_PEPPER` (at least 32 characters). The base URL must be HTTPS
on the expected Infobip domain. Setting `TRUSTED_INVITATIONS_SMS_ENABLED=false`
disables this mode. Missing configuration disables the option in the admin UI
and rejects phone issuance and verification on the server. Provider acceptance
does not demonstrate delivery to a handset; live carrier delivery requires a
separately authorised test recipient.

## Password recovery

Only accounts created by this new flow can use the recovery-code operation.
A single database transaction verifies and rotates the recovery hash, installs
a native-compatible bcrypt password hash, revokes Auth sessions/refresh tokens,
clears pending confirmation, recovery, contact-change and reauthentication
tokens, deletes Auth one-time tokens, and emits the existing session-revocation
events. These token resets follow [GoTrue v2.198.0 UpdatePassword](https://github.com/supabase/auth/blob/v2.198.0/internal/models/user.go).
Other account types are not
eligible. Existing access JWTs retain Supabase's normal expiry semantics; the
application's existing session check and revocation listener close their sessions.

Recovery material is returned once, kept only in component memory, and never
stored in local storage, logs, public profiles or user-editable metadata.

## Release and verification

Apply the trusted-invitations, username-guard and Auth-reservation migrations
and deploy the matching Edge Function before
publishing the frontend. The function uses its own authentication and therefore
has gateway `verify_jwt=false`; this is necessary for invitation recipients and
does not make administrative operations public. Build and run the focused
invitation/login/recovery tests and the SQL/handler tests before release.

Verify administrative denial without a valid session, unavailable/expired/used
invitation responses, the status of the published version, and the actual
`sms_ready` capability. Synthetic local tests cover the activation and recovery
lifecycle with the native INSERT-before-confirmation order, UUID/alias binding,
metadata rewrites, single use, OTP challenge replacement and session/token
revocation. A live end-to-end test that creates a user requires an
authorised invitation from a signed-in administrator; do not query personal
administrator records or reuse someone else's session to arrange that test.

To roll back the interface, restore the preceding frontend deployment. Keep the
backend login/recovery paths available for any trusted accounts already created.
Do not remove their Auth identities, private mapping or recovery data as part of
a frontend rollback.
