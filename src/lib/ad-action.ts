import type { Advertisement } from '@/hooks/useAdvertising';
import { safeMediaUrl } from './safe-media-url';

export interface AdAction {
  kind: 'url' | 'whatsapp' | 'none';
  href?: string;
  label: string;
}

/** Add https:// if the advertiser typed a bare domain. */
function normUrl(u?: string | null): string | null {
  const t = (u ?? '').trim();
  if (!t) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(t);
  // A domain with a port is still a bare address, not a URI scheme.
  const domainWithPort = /^[^/:\s]+\.[^/:\s]+:\d+(?:[/?#]|$)/.test(t);
  return safeMediaUrl(hasScheme && !domainWithPort ? t : `https://${t}`) ?? null;
}

/** Angolan phone → international digits for wa.me (local 9xxxxxxxx → 244…). */
function waNumber(phone?: string | null): string | null {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) d = `244${d}`; // local Angola mobile
  return d.length >= 11 ? d : null; // needs a country code to be dialable
}

/**
 * What an ad does when tapped, with a fallback chain so a published ad is never
 * a dead click: its own link → the business website → WhatsApp the business.
 * Returns 'none' only when there is genuinely nothing to open.
 */
export function resolveAdAction(ad: Advertisement): AdAction {
  const url = normUrl(ad.cta_url) ?? normUrl(ad.business?.website);
  if (url) return { kind: 'url', href: url, label: ad.call_to_action || 'Saber mais' };

  const wa = waNumber(ad.business?.phone);
  if (wa) return { kind: 'whatsapp', href: `https://wa.me/${wa}`, label: ad.call_to_action || 'Contactar' };

  return { kind: 'none', label: ad.call_to_action || 'Saber mais' };
}
