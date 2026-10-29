/**
 * Código de convite (referral). O link de convite é /register?ref=<código>.
 * Capturamos o parâmetro assim que aparece e guardamo-lo em localStorage,
 * para sobreviver à navegação até ao momento do registo.
 */
const KEY = 'yamilook_ref';

/** Lê ?ref= do URL atual e persiste-o. Chamar no arranque das páginas de entrada. */
export function captureReferralCode(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[a-zA-Z0-9]{4,16}$/.test(ref)) {
      localStorage.setItem(KEY, ref.toUpperCase());
    }
  } catch {
    /* storage indisponível — sem drama, o convite só não é atribuído */
  }
}

/** Código pendente (se o utilizador chegou por um link de convite). */
export function getReferralCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Limpar depois de um registo bem-sucedido. */
export function clearReferralCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Convites são destinados a utilizadores externos. Nunca incluir o domínio
 * do ambiente de desenvolvimento ou preview (window.location.origin).
 * O domínio abaixo está associado ao projeto de produção da YAMILOOK.
 */
const PUBLIC_INVITE_URL = 'https://www.yamilook.com/register';

/** Link de convite pessoal para partilhar, sempre no domínio público. */
export function buildInviteUrl(referralCode: string | null | undefined): string {
  const url = new URL(PUBLIC_INVITE_URL);
  if (referralCode) url.searchParams.set('ref', referralCode);
  return url.toString();
}
