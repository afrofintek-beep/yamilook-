/** Remove the old API response cache, including when switching accounts. */
export async function clearLegacyPrivateCache(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete('supabase-api');
  } catch {
    // Cache Storage may be unavailable in private browsing; never block sign-out.
  }
}
