import { buildInviteUrl } from './referral';

/** Common invitation wording for user-initiated WhatsApp and email shares. */
export function invitationMessage(recipientEmail: string, code: string): string {
  const url = buildInviteUrl(code);
  return `Foste convidado(a) para a YAMILOOK!\n\nAbre este link para te registares: ${url}\n\nO convite é pessoal e de utilização única. Regista-te com o email ${recipientEmail}.`;
}

/** WhatsApp opens the compose window; the sender still confirms the recipient and taps Send. */
export function buildWhatsAppInviteUrl(recipientEmail: string, code: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(invitationMessage(recipientEmail, code))}`;
}

/** Fallback: opens the device's email composer. It does NOT imply delivery. */
export function buildEmailInviteDraftUrl(recipientEmail: string, code: string): string {
  const subject = 'O teu convite para a YAMILOOK';
  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(invitationMessage(recipientEmail, code))}`;
}
