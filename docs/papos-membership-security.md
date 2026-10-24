# Chat membership boundary

The first security remediation removes direct membership creation and security-sensitive
column updates from browser roles. Creation now uses `create_chat_conversation`, which
derives the creator from `auth.uid()`, validates participants, creates memberships atomically
and assigns admin only to the new group creator. Direct chats reuse the existing pair.

Members may update their own mute/archive/pin/read/history preferences. Group member and
role management continues through the existing guarded admin RPCs. Conversation ownership,
type and membership identity cannot be reassigned by client-side updates. Existing members
and roles are preserved: this migration does not assert that historical memberships were
legitimate and does not automatically promote or remove anyone.

Only group admins manage group invite links. Preview uses possession of a valid code;
the invite directory is not exposed to invitees. Joining checks active status, expiration,
capacity and issuer authority, locks the invite and conversation, and grants member only.
Repeated acceptance by an existing member does not consume an additional use. New codes
use the browser cryptographic UUID generator. These are group invitations, not registration
invitations for the Yamilook MVP.

## Validation

`tests/security/chat-membership.test.mjs` runs actual PostgreSQL RLS, roles, grants and RPCs
inside PGlite. The fixture uses synthetic A/B/C identities and a minimal schema with baseline
group functions copied from production metadata. It first reproduces the old self-entry
path, then applies the exact migration and verifies denied entry/promotion, preferences,
atomic creation, deduplication, invite validity and authorised admin operations. It never
connects to production and does not replace a test of the entire deployed schema.

Reproduce without changing project dependencies:

```sh
npm install --prefix /tmp/papos-security @electric-sql/pglite@0.5.11
PGLITE_MODULE=/tmp/papos-security/node_modules/@electric-sql/pglite/dist/index.js node --test tests/security/chat-membership.test.mjs
npx vitest run src/lib/chat-conversations.test.ts
npm run build
```

The database change rejects old clients that try to create memberships directly. Reload
Yamilook/Papos to obtain the client that uses the atomic RPC. Reading existing conversations,
sending messages and changing personal conversation preferences keep their current APIs.
An existing group without an admin needs a separate, authorised review; no admin is granted
automatically using historical ownership values.

This patch does not address attachment privacy, call membership, message field integrity,
E2EE, recovery, or the other audit findings. It is not a banking security certification.
