/** References are opaque; only AFROLOC can establish existence or certification. */
export function afrolocReference(raw: string): string | null {
  const value = raw.trim();
  return value && value.length <= 128 && !/[\p{Cc}\p{Cf}]/u.test(value) ? value : null;
}

export function njilaAddressUrl(raw: string): string | null {
  const reference = afrolocReference(raw);
  try {
    return reference ? `https://www.njilamaps.com/?to=${encodeURIComponent(reference)}` : null;
  } catch { return null; }
}

export interface ChatAfroloc { reference: string; caption: string }

export function parseChatAfroloc(content: string | null): ChatAfroloc | null {
  if (!content || content.length > 5000) return null;
  const lines = content.split('\n');
  const candidates = lines.filter(line => line.startsWith('📍 '));
  if (candidates.length !== 1) return null;
  try {
    const url = new URL(candidates[0].slice(3));
    if (url.origin !== 'https://www.njilamaps.com' || url.pathname !== '/' || url.hash || url.username || url.password) return null;
    if (Array.from(url.searchParams.keys()).join(',') !== 'to') return null;
    const reference = afrolocReference(url.searchParams.get('to') ?? '');
    if (!reference) return null;
    return { reference, caption: lines.filter(line => line !== candidates[0]).join('\n').trim() };
  } catch { return null; }
}
