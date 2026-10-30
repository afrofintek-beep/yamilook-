/** Local, bounded diagnostics: no account IDs, messages, media or query strings. */
const key = 'kosolola-render-diagnostic-v1';
export function renderDiagnostic(error: Error, componentStack: string | null | undefined) {
  const category = /maximum update depth/i.test(error.message) ? 'update-loop'
    : /rendered (more|fewer) hooks|change in the order of hooks/i.test(error.message) ? 'hook-order'
    : /loading chunk|dynamically imported module|importing a module script failed/i.test(error.message) ? 'asset-load'
    : 'render-exception';
  // Retain generated asset file/line locations only; discard exception text and URLs.
  const frames = [...(error.stack || '').matchAll(/(?:assets\/)([\w.-]+\.(?:js|tsx):\d+:\d+)/g)]
    .slice(0, 8).map(match => match[1]);
  const components = (componentStack || '').split('\n').map(line => /^\s*at ([A-Za-z][\w]*)/.exec(line)?.[1])
    .filter(Boolean).slice(0, 12);
  const diagnostic = { version: 1, time: new Date().toISOString(), category, frames, components };
  try { sessionStorage.setItem(key, JSON.stringify(diagnostic)); } catch { /* Storage is optional. */ }
  return diagnostic;
}
export function readRenderDiagnostic(): string {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}
