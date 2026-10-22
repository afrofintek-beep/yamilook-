export const ONLINE_LEASE_MS = 120_000;
export function isRecentlyOnline(online: boolean | null | undefined, lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!online || !lastSeen) return false;
  const age = now - Date.parse(lastSeen);
  return Number.isFinite(age) && age >= -30_000 && age < ONLINE_LEASE_MS;
}
