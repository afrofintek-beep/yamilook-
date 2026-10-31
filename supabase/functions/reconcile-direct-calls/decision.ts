export const DIRECT_CALL_RECONNECT_GRACE_MS = 45_000;
export function callHasBothPeers(caller: string, callee: string, identities: string[]) {
  return identities.includes(caller) && identities.includes(callee);
}
export function missingPeerGraceExpired(firstMissingAt: string | null, now: number) {
  if (!firstMissingAt) return false;
  const first = Date.parse(firstMissingAt);
  return Number.isFinite(first) && now - first >= DIRECT_CALL_RECONNECT_GRACE_MS;
}
