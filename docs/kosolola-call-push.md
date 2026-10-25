# KOSOLOLA incoming call push

The standalone app offers opt-in Web Push in Settings. On iOS 16.4+ it must be installed on the Home Screen. A notification opens/focuses KOSOLOLA, where the existing authenticated call poll verifies that a call is still ringing; it never auto-answers or grants microphone permission. Existing active calls are not navigated away from. This is a web notification, not native CallKit ringing.

## Backend and credentials

`call-push` verifies the caller JWT with Auth. Subscription keys and delivery claims are service-only tables with RLS and no browser grants. Only the call initiator may request delivery, only to ringing participants, with a 90-second call lifetime, bilateral block checks, per-subscription deduplication and a limit of five attempted alerts per minute. Endpoints are restricted to Apple, FCM and Mozilla HTTPS push services; expired subscriptions are removed on HTTP 404/410. Notifications expose no caller identity.

VAPID configuration is read from Edge Function secrets `CALL_PUSH_VAPID_PUBLIC_KEY`, `CALL_PUSH_VAPID_PRIVATE_KEY`, `CALL_PUSH_VAPID_SUBJECT` or, as a complete fallback, Vault secrets `call_push_vapid_public`, `call_push_vapid_private`, `call_push_vapid_subject`. Use one stable P-256 VAPID pair and subject `https://kosolola.com`. Never commit the private key. The invoker RPC `get_call_push_vapid` is executable only by service_role and does not elevate Vault privileges.

Migration `20261025145439_incoming_call_push.sql` was applied to project `rfayqekonkovfbkwjjum`; the local filename matches the recorded migration version. The Edge Function was deployed with JWT verification enabled. On 25 October 2026, following explicit user authorization, a fresh P-256 VAPID key pair and contact subject were stored in Supabase Vault. Verified through the service_role RPC that all three values are present with expected lengths and subject, and that anon/authenticated cannot execute the key-reading RPC. No private key is stored in the repository.

## Lifecycle and limits

Calls request push immediately after successful `create_call`. Push failure does not interrupt an in-app call. Delivery is best effort: connectivity, device settings, browser policy and caller interruption before the request can prevent it. No background server retry queue is included in this first version. Notification TTL is at most 30 seconds, bounded by call expiry. A delayed notification is worded as a previous call; the app checks live state before offering to answer. Cancellation cannot reliably retract an already delivered OS notification while the app is closed.

Subscriptions renew on foreground activity and expire after 30 days without renewal. Local logout unsubscribes before ending authentication and closes notifications; changing accounts removes the previous local subscription. VAPID rotation requires disabling and re-enabling device subscriptions. Deploy the frontend through the normal PR/release workflow; Edge deployment alone does not expose the activation button.

## Validation and release gate

- Focused automated tests cover push endpoint restrictions, call ownership/expiry, permission refusal, registration failure cleanup, offline unsubscribe, account switching, safe notification navigation and stale alerts.
- Production build passes. Repository-wide TypeScript check has existing errors in unrelated files; no diagnostics in the new push files.
- Run CI and test two distinct accounts on real devices. Recipient enables notifications, backgrounds the installed app/locks the phone; caller makes voice and video calls. Tap the alert and answer, then repeat with caller cancellation, blocked users, logout and denied notifications.
- Real push delivery and iPhone background behavior remain unverified until frontend publication and device testing. Do not claim alerts are active until that test passes.
