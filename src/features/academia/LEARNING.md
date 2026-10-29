# Aprender e realizar

An authenticated learner requests a private goal from an existing mentor. The mentor accepts with a plan, creates up to 20 challenges, and reviews each learner delivery. A review either requests a new version or validates the work. All versions and feedback remain available to both participants. Only the assigned mentor can complete a goal, after at least one challenge exists and every challenge has been approved.

Entry points: `/academia/percursos` and `/academia/percursos/:goalId`, linked from the Academia home screen. The learner and mentor use their existing accounts. The initial release supports written deliveries and optional HTTPS links to documents, images or video. It does not upload or fetch external evidence on the server. Users must ensure the recipient has access to linked files. Progress can be refreshed from the detail screen and on returning to the window.

The first-sale starter plan creates three ordered challenges on initial acceptance only. Other goals use the mentor's own plan and challenges. Validated skills are a private record of the reviewed work, not an accredited certificate. This release does not charge Kumbu, match mentors automatically, use AI or publish a public portfolio.

## Security and audit

All four new tables have RLS, explicit read grants and no direct browser mutation privileges. Only the learner and assigned mentor can read a goal, its challenges, submissions and audit. The Edge Function verifies the bearer with `getUser()` and invokes the RPC with the caller's token and the anon key. The private database function elevates solely to perform writes after explicit role, ownership and state checks, with an empty search path. The public wrapper is a security invoker. Both functions revoke anonymous access. The aggregate progress RPC also obeys the caller's RLS.

Every successful action writes an audit entry in the same transaction. Goal-level row locks serialize plan, challenge, submission, review and completion changes. Learner profile locks serialize the five-open-goal limit. Approved work and closed goals cannot be changed. Twenty submissions per challenge bound history growth. A learner cannot select their own account as mentor or set the actor. A mentor cannot submit work on behalf of a learner.

## Validation

- `node --test scripts/test-academia-learning.mjs`: applies the unchanged migration to an isolated Postgres WASM database. Existing profile dependencies and `auth.uid()` are minimal fixtures; role grants, RLS, PL/pgSQL transitions and constraints are real. It does not run the full historical Supabase migration chain.
- `npx vitest run src/features/academia/`: UI, API and existing Academia regressions.
- `npx playwright test -c playwright.academia.config.ts`: two isolated browser contexts complete the learner/mentor flow, including revision and narrow screens, with simulated HTTP responses. This validates the UI, not a deployed backend.
- `npm run build`: both application entries.

The `Academia learning journeys` workflow runs these checks for the PR.

## Rollout order

1. Apply `20261029110218_academia_learning_results.sql` to the intended Supabase environment and verify its RLS grants and function execution.
2. Deploy the `academia-learning` Edge Function with its included configuration. Gateway JWT verification is disabled because the handler explicitly verifies the caller with Auth. No new provider keys are required.
3. Release the frontend only after both server changes are available. Test a real learner account, assigned mentor and unrelated account against that environment. Confirm creation, revision, validation, completion and access denial.

No production database or Edge Function deployment is performed by the local test scripts.
