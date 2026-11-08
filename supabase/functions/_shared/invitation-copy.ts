import { invitationTranslations } from './invitation-translations.ts';

export const invitationLanguages = ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu'] as const;
export type InvitationLanguage = typeof invitationLanguages[number];
export function invitationLanguage(value: unknown): InvitationLanguage {
  return typeof value === 'string' && invitationLanguages.includes(value as InvitationLanguage) ? value as InvitationLanguage : 'pt';
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function invitationText(language: InvitationLanguage, source: string, values: Record<string, string> = {}) {
  const template = invitationTranslations[language][source] || source;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}

/** Pure templates: no translation request contains a recipient, name, or access code. */
export function invitationEmail(email: string, code: string, languageInput?: unknown) {
  const language = invitationLanguage(languageInput);
  const t = (source: string, values?: Record<string, string>) => invitationText(language, source, values);
  const link = 'https://www.yamilook.com/register?ref=' + encodeURIComponent(code) + '&lang=' + language;
  const title = t('Tens um convite pessoal');
  const description = t('Foste convidado(a) a fazer parte da YAMILOOK. Este convite é de utilização única e está associado ao email {{email}}.', { email });
  const fallback = t('Se o botão não funcionar, abre:');
  const ignore = t('Se não pediste este convite, podes ignorar esta mensagem.');
  const accept = t('Aceitar convite');
  return {
    subject: t('O teu convite para a YAMILOOK'),
    html: `<!doctype html><html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}"><body style="margin:0;padding:32px 12px;background:#f5f5f7;font-family:Arial,sans-serif;color:#14213d">
      <div style="max-width:520px;margin:auto;padding:32px;border-radius:18px;background:#101827">
        <div style="font-size:24px;font-weight:800;letter-spacing:2px;color:#d7ae34">YAMILOOK</div>
        <h1 style="color:white;font-size:22px;margin:30px 0 10px">${escapeHtml(title)}</h1>
        <p style="color:#e6e7eb;line-height:1.6">${escapeHtml(description)}</p>
        <p style="margin:32px 0"><a href="${escapeHtml(link)}" style="background:#d7ae34;color:#111827;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px">${escapeHtml(accept)}</a></p>
        <p style="color:#d6d6d6;font-size:13px">${escapeHtml(fallback)} <a style="color:#f8d574;word-break:break-all" href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
        <p style="color:#a1a6b0;font-size:12px;margin-top:28px">${escapeHtml(ignore)}</p>
      </div></body></html>`,
    text: [title, description, `${accept}: ${link}`, ignore].join('\n\n'),
  };
}

export function candidateInvitationEmail(name: string, code: string, languageInput?: unknown) {
  const language = invitationLanguage(languageInput);
  const t = (source: string, values?: Record<string, string>) => invitationText(language, source, values);
  return {
    subject: t('A tua candidatura à YAMILOOK foi aprovada'),
    text: [
      t('Olá {{name}},', { name }),
      t('A tua candidatura ao MVP da YAMILOOK foi aprovada!'),
      t('Cria a tua conta em {{url}} e insere o código {{code}}.', { url: 'https://www.yamilook.com/register?lang=' + language, code }),
      t('Este código é de utilização única.'),
      t('Bem-vindo(a)!'),
      t('Equipa YAMILOOK'),
    ].join('\n\n'),
  };
}
