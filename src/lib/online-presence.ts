export const ONLINE_LEASE_MS = 120_000;
export function isRecentlyOnline(online: boolean | null | undefined, lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!online || lastSeen === undefined) return false;
  // A null timestamp can be a privacy choice. The server still expires the lease
  // and publishes an offline event without disclosing the user's last-seen time.
  if (lastSeen === null) return true;
  const age = now - Date.parse(lastSeen);
  return Number.isFinite(age) && age >= -30_000 && age < ONLINE_LEASE_MS;
}
