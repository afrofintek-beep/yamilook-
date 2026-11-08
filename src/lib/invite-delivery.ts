import { uiText, uiLocale } from '@/i18n/ui-copy';
import { buildInviteUrl } from './referral';

export type InvitationBrand = 'YAMILOOK' | 'KOSOLOLA';

/** Only fixed app copy is translated. Recipient, token and URL are interpolated locally. */
export function invitationMessage(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string): string {
  const url = new URL(buildInviteUrl(code));
  url.searchParams.set('lang', uiLocale());
  const paragraphs = [
    uiText('Foste convidado(a) para a {{brand}}!', { brand }),
    uiText('Abre este link para te registares: {{url}}', { url: url.toString() }),
    uiText('O convite é pessoal e de utilização única.'),
    recipientEmail ? uiText('Regista-te com o email {{email}}.', { email: recipientEmail }) : uiText('Indica o teu email ao registar-te.'),
  ];
  if (expiresAt) paragraphs.push(uiText('Válido até {{date}}.', { date: new Date(expiresAt).toLocaleString(uiLocale()) }));
  else if (!recipientEmail) paragraphs.push(uiText('O convite é válido durante 7 dias.'));
  if (brand === 'KOSOLOLA') paragraphs.push(uiText('A conta é partilhada com a Yamilook. Depois do registo, entra na KOSOLOLA: {{url}}', { url: 'https://www.kosolola.com' }));
  return paragraphs.join('\n\n');
}

/** Opens a composer. The sender confirms the recipient and sends. */
export function buildWhatsAppInviteUrl(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(invitationMessage(recipientEmail, code, brand, expiresAt))}`;
}

/** Opening a draft does not imply delivery. */
export function buildEmailInviteDraftUrl(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string): string {
  const subject = uiText('O teu convite para a {{brand}}', { brand });
  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(invitationMessage(recipientEmail, code, brand, expiresAt))}`;
}
