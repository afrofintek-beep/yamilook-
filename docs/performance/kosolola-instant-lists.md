# KOSOLOLA list reopening

Conversation, contact and call-history hooks hydrate a per-account UI snapshot synchronously, then retain their existing authorized server refresh. Navigating away and back no longer starts with an empty list when a valid snapshot exists. Token refresh no longer restarts the call-history read.

Snapshots retain at most 100 list rows for one hour. Call history already queries the most recent 50 calls. This change does not truncate the live server result or implement server pagination. Conversation message previews (including temporary/view-once bodies and attachment URLs) are excluded from snapshots; cached profiles are not marked online. Storage failures fall back to in-memory snapshots and live reads. Successful empty lists are cached too.

Account-specific keys and render-time scope checks prevent an old account's list flashing during a switch. Auth logout, session loss and account switching clear snapshots and invalidate pending writes. Scoped setter identities reject responses from previous account scopes, including A → B → A. Existing server authorization remains required for all reads and actions.

Validation: 39 focused tests (cache hydration, blocked contact refresh, account isolation, logout, expiry, quota errors, existing chat/call/auth regressions), TypeScript no-emit check and production build. Device-level cold/warm measurements and deployed iPhone validation remain outstanding. Authentication/profile bootstrap and the first fetch without a snapshot still require network access; this change does not claim instant cold startup or full offline messaging.

No database migration is needed. Deploy the frontend through the existing repository pipeline. Acceptance on iPhone: open each list once, navigate away/back on slow connectivity, confirm immediate cached rows followed by refreshed data; sign out and verify no previous-account rows when using another account.
