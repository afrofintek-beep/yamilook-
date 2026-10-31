# AFROLOC integration — 30 October 2026

Updated Yamilook PR #29 against current main, resolving the KOSOLOLA settings conflict while preserving ringtone controls and the AFROLOC link panel. Completed authorization now updates the local link display and clears the consumed request and consent. The legacy manual-review screen explicitly distinguishes local decisions from AFROLOC-issued certificates and reports query failures instead of showing an empty queue.

Verified read-only in hosted projects: neither Yamilook production nor AFROLOC production has the new phone/link/evidence tables. Yamilook staging pufcziszxmymoaodslii remains MIGRATIONS_FAILED and lacks public.profiles and afroloc_link_requests. A schema baseline must be restored from the real schema before that staging flow can run; a toy profile table used in isolated SQL tests is not a deployment baseline.

Validation: 32 AFROLOC SQL/Node tests, 5 Yamilook evidence tests, 4 account-link UI tests pass. Cross-service handlers with actual SQL and exact SDK 2.90.1 pass with mocked Auth and SMS. Yamilook production build passes. These are local verification results, not evidence of live SMS or production account linking.

Activation still requires the staging schema baseline, server partner/OTP secrets, restricted SMS configuration, matching staging frontends, and a real two-account test with a reviewed test certificate. Production is not activated. The corresponding AFROLOC authority work is PR #4. Keep certificate issuance in the AFROLOC authority and consume current, exact-bound, unexpired evidence in Yamilook.

Full Yamilook suite: 700 passed, 2 failed (113 files). Both failures are existing auth-hook assertions expecting localhost redirects while the current implementation uses www.yamilook.com. The focused auth-hook rerun reproduces those mismatches. They are outside the account-link changes and the full suite is not green.

Publication: local commits 40b26e7 and 01b9427 were prepared; automatic approval review rejected pushing the branch because explicit authorization for publication to that GitHub remote was not established. No workaround was attempted.
