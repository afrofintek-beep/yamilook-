# Isolated invitation staging and mail DNS review — 2026-11-08

## Applied to development only

Development Supabase project: pufcziszxmymoaodslii (session-validation-20261027-browser).

Site URL: https://yamilook-i0ki5ksla-afrofintek-2071s-projects.vercel.app
Only redirect allow-list entry: https://yamilook-i0ki5ksla-afrofintek-2071s-projects.vercel.app/**

Removed the development allow-list entries for www.yamilook.com, yamilook.com and yamilook-clean.vercel.app. Production Auth settings were not changed.

Preview deployment dpl_7b8SvVCDVRs52abqveN2MxExj91P built commit 882871cbdd31f789349c076508ba700571bfb1f9. It is a preview (target null), not a production deployment. Separate project creation was denied by the connected Vercel account; the preview uses the existing project with a deployment-specific staging-invitations root. Its wrapper builds the existing frontend with the development public Supabase key and deployment-specific callback origin. No service-role or SMTP secret is committed.

## Verification

- 13 tests passed across public-site, referral and Register.
- Vercel build reached READY.
- Authenticated HTTP fetch of /login returned 200.
- The deployed app-install JavaScript returned 200 and contains both the development Supabase project and the exact preview callback origin.
- Production public-site origin remains the default when no explicit staging origin is configured.
- Prior actual SMTP test passed signup, receipt, confirmation, login, used-invitation rejection and global logout. This was before the callback isolation change; it must not be presented as a full browser test of this preview.

## Remaining browser validation

The preview is protected by Vercel Authentication. HTTP verification through the connected account succeeded; interactive browser validation has not completed.
The development database contains minimal invitation fixtures, not the complete application schema. In particular profiles lacks onboarding fields and authenticated read policies; full onboarding also needs public_profiles and residence-related database dependencies. Do not claim the complete user interface path passed. Prepare a representative isolated application schema before completing signup → email link → profile → invitation interface testing. Do not weaken production RLS or copy production personal data to solve this.

## Production DNS changes — APPLIED after explicit approval

Authoritative nameservers observed: ns23.worldnic.com and ns24.worldnic.com.
Resend domain region: Ireland (eu-west-1).
The earlier test reported SPF none and DKIM fail for yamilook.com. After the user explicitly authorized the three records, they were updated in Network Solutions on 2026-11-08.

| Type | Name | Previous value | Applied value |
| --- | --- | --- | --- |
| TXT | send.yamilook.com | Missing | v=spf1 include:amazonses.com ~all |
| MX | send.yamilook.com | 10 feedback-smtp.us-east-1.amazonses.com. | 10 feedback-smtp.eu-west-1.amazonses.com. |
| TXT | resend._domainkey.yamilook.com | Public key has an extra trailing lowercase p | Exact public key below, ending IDAQAB |

Expected DKIM TXT value from the authenticated Resend domain configuration:

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC28d8wYm3LxkRpVFz1k7d2/YIdEwAjTz2Iyk1Ie7qC15qa1xPgD9jMmEdVdsY4ZAp5PrdaxxrFUAmRhkmJ/FNDxbnab1d4N9H6Qa51XUbfSuJB5afn9JclZrN0Z1YEVFg03nUCGVlUo9GyBUBgdvjOsxl+GXaltUC3XC17Js81FQIDAQAB
```

The authoritative zone was read before editing. Existing DKIM TTL (3600) and MX TTL (7200) were preserved; the new SPF TTL is 3600. Website records, root MX records, nameservers and unrelated TXT records were preserved. No DMARC policy change was made.

Explicit user approval was received before application. Network Solutions confirmed all three saves. Public DNS confirmed corrected MX and DKIM; an earlier resolver query still cached the absent SPF, but the subsequent Gmail delivery below validated SPF successfully. Rollback: restore previous MX and DKIM values and remove only the newly added SPF TXT record if rollback is necessary.

## Post-change real email verification

At 13:27:46 Africa/Luanda (12:27:46 UTC) on 2026-11-08, the development Supabase password-recovery endpoint sent one email to the existing synthetic test account's authorized Gmail alias. Gmail placed the message in INBOX and reported:

- SPF: pass for send.yamilook.com.
- DKIM: pass for yamilook.com, selector resend.
- DKIM: pass for amazonses.com.
- Sending region: eu-west-1.
- X-Pm-Metadata-Project-Ref: pufcziszxmymoaodslii.
- The email link's redirect_to points to the isolated preview /reset-password path.

No password was changed and the recovery token was not consumed. No real production user account was modified. This confirms mail transport/authentication and the requested redirect in an actual email; full browser onboarding remains pending as described above.
