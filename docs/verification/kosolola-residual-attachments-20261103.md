# KOSOLOLA — residual attachment exposure, 3 November 2026

## Conclusion

Residual historical exposure is confirmed and is **not fully remediated** by this
release. Anonymous range GET requests returned HTTP 206 for 32 original media
objects: 31 already converted to private chat references and one still referenced
by two conversations. The public `media` bucket is intentionally unchanged to
preserve legitimate MUXI content. No files were deleted, moved, overwritten or
quarantined; no real message references were changed.

Exact historical URL probes additionally found **one previously issued signed
voice URL still returning HTTP 206 without authentication after the new policy
was applied**. Its JWT expiry claim is 6 November 2026, 19:51 UTC / 20:51 Luanda.
The expiry claim was decoded locally without publishing the token; continued
access up to expiry is a risk, not a promise of future server behavior. Thus 33
distinct original objects were retrievable through at least one tested route.

## Reconciliation and public-content classification

The audit reconciled 59 distinct historical candidates / 60 references, using both
the service-only migration registry and the remaining message URL fields.

| Group | Objects | References | Anonymous public object route |
| --- | ---: | ---: | --- |
| Converted media originals | 31 | 31 | 31 × HTTP 206, still exposed |
| Converted voice originals | 2 | 2 | 2 × HTTP 400, private bucket |
| Voice originals absent from Storage metadata | 25 | 25 | 25 × HTTP 400 |
| Media shared by two conversations | 1 | 2 | HTTP 206, still exposed |

The 27 unchanged references are therefore **not 27 publicly readable files**.
The object used by two conversations is shared within KOSOLOLA; no MUXI reference
to it was found. All 59 candidates were checked against the conservative database
inventory of string, array and JSON columns in public base tables, excluding the
message, scheduled-message and attachment-registry tables. All returned zero
external matches. A separate canonical path comparison against all 135 post rows
with media at the inventory snapshot also found zero MUXI overlaps. This is a
database-snapshot finding, not proof against future writes, external links, cached
pages or backup contents. It does not authorize source deletion.

Among the 135 post rows with media, visibility values were `everyone` (58),
`contacts` (62) and `only_me` (15), with no hidden rows. Matching checked all three
groups, not only publicly intended posts. The anonymous MUXI regression sample
uses `everyone` posts only. This audit does not certify the wider MUXI privacy model.

The JSON evidence contains opaque SHA-256 identifiers of bucket/path, HTTP results
and counts only. It does not publish private object URLs, bearer tokens, account
identifiers or message contents. Exact original URLs remain in the existing
service-only manifests and remaining message records.

## Corrections applied to the production database

Migration `20261103201434_kosolola_legacy_voice_permissions` was applied through
the Supabase migration API and independently read back. The generated local file
was renamed to the actual server migration version; its SQL is unchanged.

- Replaces the broad authenticated voice SELECT policy with current participant
  authorization, including deleted/expired/hidden messages and cleared history.
- Preserves access through successfully converted private references. An orphan
  with no currently authorized message is denied, including to its uploader.
- Adds restrictive SELECT boundaries so another permissive policy cannot reopen
  legacy voice reads, and blocks client insert/update/delete on that legacy bucket.
  Current uploads continue through `chat-attachments`.
- Prevents a guessed old voice URL from granting access when inserted into another
  conversation, a thumbnail or a scheduled message. Authorized forwarding remains
  possible.
- Makes recipient message updates an explicit receipt-field allowlist. A recipient
  cannot alter `is_deleted`, `expires_at`, `is_view_once`, thumbnails or future
  sender-owned fields to reopen protected media.

Production SQL using the authenticated role and a synthetic nonparticipant UUID
reproduced access to all **3** legacy voice objects before the patch. Afterward the
same identity sees **0** legacy voice and **0** private attachment objects. These
checks read counts only; no real user was signed in or impersonated. The original
broad policy is absent. Voice and chat buckets remain private; MUXI media remains
public. All 33 converted manifests remain `references_private` and unquarantined;
the voice count remains 3 and private Storage count 71. Public media grew from 147
to 148 during concurrent normal use; this audit performed no object writes.

## Frontend correction

The reader recognizes same-project historical public, signed and authenticated
voice URLs and requests a fresh authorized URL **before** playback. An expired
stored signature is no longer treated as the playable source. Authorization failure
does not fall back to the old URL. The application requests a 300-second link;
ordinary public MUXI media behavior is unchanged. Merge and production deployment
must be verified separately from the database migration.

## Verification

- 34 passing Node/PGlite test results across private attachment authorization,
  atomic migration/recovery and the new legacy voice fixture (including parent
  suites). The new fixture first reproduces the old broad disclosure, then tests
  sender/recipient/outsider/anonymous access, removal, expiry, deletion, hidden
  history, guessed references, forwarding, field tampering, immutable originals,
  conflicting permissive policies and retained originals after conversion.
- 17 focused frontend tests passed; production build passed for Yamilook and
  KOSOLOLA.
- The broad local suite first reported 968 passing tests, two timed assertion
  failures and three suite-import failures caused by missing Supabase test
  environment variables. All five affected files passed on a focused rerun with
  a synthetic project URL/key (49 tests). The sharing test also passed unchanged
  on the baseline commit. This is not a claim that the original full-suite run
  was green.
- Live anonymous probes are byte-range requests with no Authorization, API key or
  session cookie. Only status/headers are retained; media contents are not inspected.
- Database policy checks are distinct from HTTP bearer-link behavior. No physical
  iOS/Android playback or signed-in browser flow is claimed by this audit.
- Exact historical probes: 59 distinct URLs, 33 × HTTP 206 (32 public media +
  1 signed voice) and 26 × HTTP 400. Three private live-copy and three recovery-copy
  public routes each returned HTTP 400. Metadata reconciliation confirms all 33
  original/private/recovery triples still exist; their bytes were not rehashed in
  this non-migrating audit.

## Residual risks and the next infrastructure operation

1. **32 anonymous-readable originals remain high priority.** Anyone obtaining one
   of these URLs can retrieve the object without joining a conversation. Being
   absent from MUXI today does not make an uncoordinated move safe. Authenticated
   clients can also enumerate the public `media` bucket under its existing policy,
   so risk is not limited to URLs already leaked externally. No evidence of actual
   unauthorized downloads was established; the audit proves access capability.
2. **Signed URLs are bearer capabilities.** Membership removal stops future
   authorization, not use of an already issued URL or bytes previously downloaded.
   The application's 300-second request is not a server-enforced maximum for every
   possible Storage API client. Legacy links issued before this patch may outlive
   it; one such live URL is confirmed above. Instant revocation requires a server-authorized delivery layer or a separate
   validated object/key retirement design. View-once consumption and end-to-end
   encryption are not delivered by this patch.
3. **25 missing sources remain unresolved.** HTTP 400 in a private bucket alone
   cannot prove absence; the missing classification comes from privileged Storage
   metadata reconciliation. Recovery needs the provider's object backups/retention
   history or another independently verified source. No missing file was fabricated.
4. **The two-conversation object needs separate conversion.** Preserve both
   conversations' access boundaries; do not reuse the earlier single-conversation
   batch runner without an independently tested design.

The safe deactivation sequence is: freeze introduction of candidate URLs across
chat and public publishing paths; repeat the complete reference inventory under
write coordination; rehash source/private/recovery bytes; rehearse reversible
private quarantine and rollback with synthetic data; convert the shared object
with both authorization boundaries; withdraw only validated chat-exclusive public
endpoints while retaining original bytes and recovery copies; verify origin and
CDN/cache denial plus participant reads and public MUXI regression. Unfreeze only
after reconciliation. No bulk change of the public `media` bucket is acceptable.

Database administration and normal frontend deployment were accessible in this
session. Provider-level object backup recovery, historical access-log retention,
and a validated per-object quarantine/cache purge workflow were not established.
These are distinct from code integration and must not be described as already
published remediation.

## Sources

- [PR #2](https://github.com/afrofintek-beep/yamilook-/pull/2)
- [31 October production receipt](https://github.com/afrofintek-beep/yamilook-/blob/d74a9b6ac77fe170f737d1ff9c89d86a1e702954/docs/verification/private-chat-production-20261031.md)
- Current production schema and policies in the `yamilook` Supabase project,
  migration history, service-only registry and Storage metadata (3 November).
- [Supabase bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals)
