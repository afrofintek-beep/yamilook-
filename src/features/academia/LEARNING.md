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

1. Apply `20261029113425_academia_learning_results.sql` to the intended Supabase environment and verify its RLS grants and function execution.
2. Deploy the `academia-learning` Edge Function with its included configuration. Gateway JWT verification is disabled because the handler explicitly verifies the caller with Auth. No new provider keys are required.
3. Release the frontend only after both server changes are available. Test a real learner account, assigned mentor and unrelated account against that environment. Confirm creation, revision, validation, completion and access denial.

No production database or Edge Function deployment is performed by the local test scripts.

## Communities, small cohorts and voluntary public work

The next phase adds six public affinity communities and mentor-authored, free entry challenges. The seeded entries are discovery categories and editable starting examples, not fabricated mentors, cohorts, students or outcomes. Mentors publish a plan, a first challenge, skill, language, locality, experience level and requirements. A mentor can have at most three open-registration cohorts. Cohorts admit at most twenty learners.

Joining atomically reserves one lifetime entry seat and copies the mentor's published plan and first challenge into an active private learning goal. Repeated joins return the existing goal without consuming another seat, including after registration closes. Seats are not recycled after cancellation. Goal limits are shared across individual and cohort journeys. No Kumbu charge, automatic public sharing, group chat or continuous video call is introduced. Private feedback remains one-to-one; the cohort is an asynchronous challenge group. The mentor can adapt each private goal using the existing controls.

The cohort mentor can read their own roster, private progress and the number of enrollments attributed to published work. Fellow learners cannot read one another's membership or goal. A shared, published work ID can attribute a new enrollment; invalid, withdrawn or unrelated sources do not generate attribution. These counts are enrollments, not views, reach or a promise of viral growth. No financial referral rewards are issued.

Only the owner of a mentor-approved challenge can create a public presentation, with explicit consent. It contains the challenge title, validated skill, learner/mentor display names and a learner-written caption. The original submission and feedback are never copied. Evidence is excluded by default; opting in includes only the URL of the approved submission. Private ownership and challenge links live in a separate protected source table. The learner can withdraw or republish the same presentation ID. Previously copied content or externally hosted files cannot be recalled by withdrawing the Academia page.

Public discovery and presentations are accessible without an account. Share links always use www.yamilook.com. A narrowly validated return path preserves the community challenge and valid proof attribution through email/password login, registration and onboarding, with normal account/invitation requirements. It rejects external destinations and strips unrelated query parameters. Real email confirmation and social OAuth return continuity are not validated by the simulated browser tests.

The implementation uses text and optional external links, with no autoplaying media or required video upload. The first version supports manual refresh and normal focus revalidation, not live roster push updates. Public link previews retain the site's current generic social metadata; no per-work Open Graph images are generated.

### Additional rollout and checks

Apply `20261029123434_academia_communities.sql`, redeploy the updated `academia-learning` function, then release the frontend. The migration also changes the existing private goal-creation profile lock to `FOR NO KEY UPDATE`: it still serializes learner limits while allowing foreign-key references, avoiding unnecessary profile-lock conflicts in cross-mentoring enrollment. A multi-connection contention/load test has not been performed.

`node --test scripts/test-academia-communities.mjs` applies both learning migrations to an isolated Postgres WASM instance and tests real RLS, capacity, idempotence, private rosters, explicit consent, validation, attribution and withdrawal. `academia-communities.spec.ts` exercises mentor creation, learner enrollment/review/publication, anonymous discovery, a referred peer enrollment and withdrawal with simulated transport in WebKit. The existing private journey, account and invitation tests remain part of CI.

The migration file versions match the versions registered by deployment in Supabase. This alignment renames repository files only; existing production migration-history rows were not edited. SQL contents were verified by matching MD5 hashes before the rename.
