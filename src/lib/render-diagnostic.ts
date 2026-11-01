/** Local, bounded diagnostics: no account IDs, messages, media or query strings. */
import { isApplicationAssetError } from './asset-load-error';
const key = 'kosolola-render-diagnostic-v1';
export function renderDiagnostic(error: unknown, componentStack: string | null | undefined) {
  const detail = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const message = typeof detail.message === 'string' ? detail.message : typeof error === 'string' ? error : '';
  const stack = typeof detail.stack === 'string' ? detail.stack : '';
  // Production React errors contain a numeric code instead of the full message.
  const reactCode = /Minified React error #(\d{1,4})\b/.exec(message)?.[1];
  const category = /maximum update depth/i.test(message) || reactCode === '185' ? 'update-loop'
    : /rendered (more|fewer) hooks|change in the order of hooks/i.test(message) || ['300', '310', '311'].includes(reactCode || '') ? 'hook-order'
    : isApplicationAssetError(error) ? 'asset-load'
    : 'render-exception';
  const reason = /cannot add postgres_changes.*after subscribe|subscribe.*only.*once/i.test(message) ? 'subscription-reused'
    : reactCode ? `react-${reactCode}` : 'unclassified';
  // Safari may omit error.stack but retain locations in React's componentStack
  // or sourceURL/line/column. Never retain exception text, URLs or query values.
  const locations = [stack, componentStack || ''].join('\n');
  const frames = [...new Set([...locations.matchAll(/assets\/([\w.-]+\.(?:js|mjs|tsx):\d+:\d+)/g)].map(match => match[1]))].slice(0, 8);
  if (!frames.length && typeof detail.sourceURL === 'string') {
    const file = /\/assets\/([\w.-]+\.(?:js|mjs))(?:[?#].*)?$/.exec(detail.sourceURL)?.[1];
    if (file && Number.isSafeInteger(detail.line) && Number.isSafeInteger(detail.column)) {
      frames.push(`${file}:${detail.line}:${detail.column}`);
    }
  }
  const components = (componentStack || '').split('\n').map(line => /^(?:\s*at |\s*)([A-Za-z][\w]*)(?:@|\s+\()/.exec(line)?.[1])
    .filter(Boolean).slice(0, 12);
  const errorType = ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'DOMException', 'InvalidStateError', 'NotAllowedError', 'SecurityError'].includes(String(detail.name)) ? detail.name : 'unknown';
  const diagnostic = { version: 2, build: import.meta.env.APP_BUILD_ID || 'development', time: new Date().toISOString(), category, reason, errorType, hasStack: !!stack, frames, components };
  try { sessionStorage.setItem(key, JSON.stringify(diagnostic)); } catch { /* Storage is optional. */ }
  return diagnostic;
}
export function readRenderDiagnostic(): string {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}
