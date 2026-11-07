import { buildInviteUrl } from './referral';

export type InvitationBrand = 'YAMILOOK' | 'KOSOLOLA';

/** Common invitation wording for user-initiated WhatsApp and email shares. */
export function invitationMessage(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string): string {
  const url = buildInviteUrl(code);
  return `Foste convidado(a) para a ${brand}!\n\nAbre este link para te registares: ${url}\n\nO convite é pessoal e de utilização única. ${recipientEmail ? `Regista-te com o email ${recipientEmail}.` : (expiresAt ? 'Indica o teu email ao registar-te.' : 'Indica o teu email ao registar-te. O convite é válido durante 7 dias.')}${expiresAt ? `\nVálido até ${new Date(expiresAt).toLocaleString('pt-PT')}.` : ''}${brand === 'KOSOLOLA' ? '\n\nA conta é partilhada com a Yamilook. Depois do registo, entra na KOSOLOLA: https://www.kosolola.com' : ''}`;
}

/** WhatsApp opens the compose window; the sender still confirms the recipient and taps Send. */
export function buildWhatsAppInviteUrl(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(invitationMessage(recipientEmail, code, brand, expiresAt))}`;
}

/** Fallback: opens the device's email composer. It does NOT imply delivery. */
export function buildEmailInviteDraftUrl(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string): string {
  const subject = `O teu convite para a ${brand}`;
  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(invitationMessage(recipientEmail, code, brand, expiresAt))}`;
}
