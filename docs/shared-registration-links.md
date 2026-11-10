# Shared registration links

A reusable `/register?ref=CODE` link admits up to an administrator-defined number of new accounts. It uses the existing onboarding and email confirmation flow. It is separate from single-use invitations, the initial 100-candidate delivery workflow and member invitation quotas.

The database locks the link row when creating an account, checks status, server time, issuer role and remaining capacity, and increments usage in the same transaction as signup. Failed account/profile creation rolls back the redemption and counter. A deleted account does not reopen a place. Each account takes a place before email confirmation; the administrative panel shows registrations and confirmed emails separately. The link is a bearer invitation and can be forwarded; it does not restrict admission to a list of names.

Creation is administrator-only via `create_registration_link(request_uuid, name, max_uses, ttl_hours)`. Retries with the same request and settings return the same link. Validity is at most 168 hours. No link or account is created by the migration.

Administration → **Convites coletivos** lists links, usage, confirmations and expiry and allows suspension/resumption. Resumption never resets the counter or extends expiry. The panel is translated into the application's ten languages. All management RPCs validate the caller on the server. Private tables have RLS and no anonymous/authenticated direct access. Existing signup validation and invitation consumption preserve their other paths; no registration or SMTP settings are changed.

## Validation

Run `python tests/invitation-campaigns/shared_links.py` against a fresh local PostgreSQL 17 database with the same environment restrictions as the controlled campaign harness. This runs all 14 existing tests and five shared-link tests: permissions/idempotency, 40 simultaneous attempts for 21 places, expiry/suspension/issuer revocation, transaction rollback/deletion accounting, and eight concurrent repeatable-read snapshots for one place.

These database tests use synthetic Auth/profile contracts and the actual invitation migrations. They do not prove email delivery or the entire onboarding wizard. UI tests cover administrative suspension success/failure and capacity reporting. Production email confirmation must remain enabled (`mailer_autoconfirm=false`).

Operational rollback: suspend the link and preserve audit/redemption records. Do not revert the signup validator while active shared links exist. A frontend rollback does not remove database enforcement.
