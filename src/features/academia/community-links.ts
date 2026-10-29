import { getYamilookPublicUrl } from '@/lib/public-site';
export const communityLevels: Record<string, string> = { beginner: 'Para começar', practice: 'Já tenho alguma prática', advanced: 'Quero aprofundar' };
export function workShareUrl(id: string) { return getYamilookPublicUrl(`/academia/trabalhos/${encodeURIComponent(id)}`); }
export function communityReturn(search: string) {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  try {
    const url = new URL(next, 'https://www.yamilook.com');
    if (url.origin !== 'https://www.yamilook.com' || !/^\/academia\/comunidades(?:\/[a-z0-9-]+)?(?:\/turmas\/[0-9a-f-]{36})?\/?$/.test(url.pathname)) return null;
    const source = referralWork(url.search);
    return url.pathname + (source ? `?origem=${source}` : '');
  } catch { return null; }
}
export function referralWork(search: string) {
  const id = new URLSearchParams(search).get('origem');
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
}
export async function shareValidatedWork(id: string, title: string) {
  const url = workShareUrl(id);
  if (navigator.share) {
    try { await navigator.share({ title, text: `Mostro o que aprendi na Academia: ${title}`, url }); return 'Partilha preparada.'; }
    catch (error) { if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') return 'Partilha cancelada.'; }
  }
  if (navigator.clipboard) { await navigator.clipboard.writeText(url); return 'Ligação copiada.'; }
  return 'Usa a ligação abaixo para partilhar.';
}
