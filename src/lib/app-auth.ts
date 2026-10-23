/** Separate browser sessions; both clients still authenticate against the same project. */
export function applicationAuthStorageKey(projectUrl: string, pathname: string): string | undefined {
  if (pathname !== '/papos-app' && !pathname.startsWith('/papos-app/')) return undefined;
  return `sb-${new URL(projectUrl).hostname.split('.')[0]}-papos-auth-token`;
}
