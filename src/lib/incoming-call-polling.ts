/** Keep incoming calls reliable without making a database request every 2s. */
export function shouldPollIncomingCall({
  now, lastCheckAt, subscribed, visible,
}: { now: number; lastCheckAt: number; subscribed: boolean; visible: boolean }) {
  // A missing/unhealthy realtime channel retains the original 2-second safety
  // net while foregrounded. Background checks are less frequent; push and
  // realtime remain available and foreground restoration checks immediately.
  const interval = visible ? (subscribed ? 12000 : 2000) : (subscribed ? 30000 : 10000);
  return lastCheckAt === 0 || now - lastCheckAt >= interval;
}
