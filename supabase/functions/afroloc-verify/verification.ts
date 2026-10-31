/** Legacy contract test harness; NOT used by the suspended production handler.
 * Replace boolean evidence and atomic persistence before enabling any partner. */
export interface VerifiedIdentity { id: string; phone?: string; phone_confirmed_at?: string }
export interface VerificationPorts {
  getUser(token: string): Promise<VerifiedIdentity | null>;
  getAddress(userId: string): Promise<string | null>;
  lookup(phone: string, code: string): Promise<{ ok: boolean; payload: unknown }>;
  save(userId: string, expectedCode: string): Promise<boolean>;
}
export interface VerificationConsent { consent: true; code: string }
export async function verifyCertification(token: string, ports: VerificationPorts, consent?: VerificationConsent) {
  try {
  const user = await ports.getUser(token);
  if (!user) return { certified: false, reason: 'unauthorized' };
  if (consent?.consent !== true || typeof consent.code !== 'string' || !consent.code.trim()) return { certified: false, reason: 'consent_required' };
  // Never use editable profile.phone_number or user_metadata as proof of ownership.
  const phone = user.phone?.trim();
  if (!phone || !user.phone_confirmed_at || !/^\+?[1-9]\d{7,14}$/.test(phone)) {
    return { certified: false, reason: 'phone_not_verified' };
  }
  const address = await ports.getAddress(user.id);
  if (!address) return { certified: false, reason: 'no_address' };
  if (consent.code !== address) return { certified: false, reason: 'address_changed' };
  const result = await ports.lookup(phone.startsWith('+') ? phone : `+${phone}`, address);
  if (!result.ok) return { certified: false, reason: 'partner_unavailable' };
  const envelope = result.payload as { success?: unknown; data?: unknown } | null;
  if (!envelope || typeof envelope !== 'object' || envelope.success === false) {
    return { certified: false, reason: 'invalid_partner_response' };
  }
  const data = (envelope.data ?? envelope) as { certified?: unknown; code?: unknown };
  if (data.certified === false) return { certified: false, reason: 'not_certified' };
  if (data.certified !== true || typeof data.code !== 'string' || !data.code.trim()) {
    return { certified: false, reason: 'invalid_partner_response' };
  }
  // A phone can have several addresses. Do not replace or certify a different declaration.
  if (data.code !== address) return { certified: false, reason: 'address_mismatch' };
  const current = await ports.getUser(token);
  if (!current || current.id !== user.id || current.phone !== user.phone || current.phone_confirmed_at !== user.phone_confirmed_at) return { certified: false, reason: 'identity_changed' };
  if (!await ports.save(user.id, address)) return { certified: false, reason: 'save_failed' };
  return { certified: true, code: address };
  } catch {
    return { certified: false, reason: 'verification_unavailable' };
  }
}
