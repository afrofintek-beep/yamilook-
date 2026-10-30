/** Accept only a current observation over the authenticated partner channel.
 * This is not a cached credential or authorization for a payout.
 */
export function validEvidence(
  value: unknown,
  expected: { subject: string; code: string; linkId: string },
  now: number,
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isFinite(now)) return false;
  const e = value as Record<string, unknown>;
  const time = (v: unknown) => typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN;
  const issued = time(e.issued_at), expires = time(e.expires_at), checked = time(e.checked_at);
  return e.ok === true && e.certified === true && e.version === 1 &&
    e.status === 'active' && e.revoked_at === null && e.relationship === 'owner' &&
    e.issuer === 'afroloc.ao' && e.audience === 'yamilook' &&
    e.subject === expected.subject && e.code === expected.code && e.link_id === expected.linkId &&
    typeof e.evidence_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.evidence_id) &&
    issued <= now && issued <= checked && expires > now && expires > checked &&
    expires - issued <= 90 * 24 * 60 * 60 * 1000 &&
    checked <= now + 5000 && checked >= now - 30000;
}
