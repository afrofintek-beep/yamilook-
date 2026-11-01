import { AuthRetryableFetchError } from '@supabase/supabase-js';

/** A refresh rate limit is temporary, not evidence that credentials were revoked.
 * Keep the SDK's retryable-error path and bound network retries without storing
 * or logging tokens. Password login and explicit credential rejection are unchanged.
 */
export function createAuthFetch(projectUrl: string, fetcher: typeof fetch = fetch): typeof fetch {
  const tokenUrl = new URL('/auth/v1/token', projectUrl);
  let retryAt = 0;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const isRefresh = url.origin === tokenUrl.origin && url.pathname === tokenUrl.pathname
      && url.searchParams.get('grant_type') === 'refresh_token';
    if (isRefresh && Date.now() < retryAt) {
      throw new AuthRetryableFetchError('Authentication refresh temporarily rate limited', 429);
    }
    const response = await fetcher(input, init);
    if (isRefresh && response.status === 429) {
      const header = response.headers.get('Retry-After');
      const seconds = header === null ? NaN : Number(header);
      const delay = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : NaN;
      retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 60_000);
      throw new AuthRetryableFetchError('Authentication refresh temporarily rate limited', 429);
    }
    return response;
  };
}
