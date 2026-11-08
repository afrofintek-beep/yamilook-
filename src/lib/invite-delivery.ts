import { uiText, uiLocale } from '@/i18n/ui-copy';
import { buildInviteUrl } from './referral';

export type InvitationBrand = 'YAMILOOK' | 'KOSOLOLA';

/** Only fixed app copy is translated. Recipient, token and URL are interpolated locally. */
export function invitationMessage(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string, language = uiLocale()): string {
  const url = buildInviteUrl(code, language);
  const t = (source: string, values?: Record<string, string>) => uiText(source, values, language);
  const paragraphs = [
    t('Foste convidado(a) para a {{brand}}!', { brand }),
    t('Abre este link para te registares: {{url}}', { url }),
    t('O convite é pessoal e de utilização única.'),
    recipientEmail ? t('Regista-te com o email {{email}}.', { email: recipientEmail }) : t('Indica o teu email ao registar-te.'),
  ];
  if (expiresAt) paragraphs.push(t('Válido até {{date}}.', { date: new Date(expiresAt).toLocaleString(language) }));
  else if (!recipientEmail) paragraphs.push(t('O convite é válido durante 7 dias.'));
  if (brand === 'KOSOLOLA') paragraphs.push(t('A conta é partilhada com a Yamilook. Depois do registo, entra na KOSOLOLA: {{url}}', { url: 'https://www.kosolola.com' }));
  return paragraphs.join('\n\n');
}

/** Opens a composer. The sender confirms the recipient and sends. */
export function buildWhatsAppInviteUrl(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string, language = uiLocale()): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(invitationMessage(recipientEmail, code, brand, expiresAt, language))}`;
}

/** Opening a draft does not imply delivery. */
export function buildEmailInviteDraftUrl(recipientEmail: string, code: string, brand: InvitationBrand = 'YAMILOOK', expiresAt?: string, language = uiLocale()): string {
  const subject = uiText('O teu convite para a {{brand}}', { brand }, language);
  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(invitationMessage(recipientEmail, code, brand, expiresAt, language))}`;
}
