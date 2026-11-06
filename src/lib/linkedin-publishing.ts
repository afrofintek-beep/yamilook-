import { supabase } from '@/integrations/supabase/client';
const messages: Record<string, string> = {
  integration_disabled: 'A ligação direta ao LinkedIn ainda não está disponível.',
  connect_linkedin: 'Liga novamente a tua conta LinkedIn.',
  unauthorized: 'Entra novamente na Yamilook.',
  media_too_large: 'Para envio direto, usa vídeo MP4 até 100 MB ou imagem até 4 MB.',
  unsupported_media: 'Usa um vídeo MP4 ou uma imagem JPEG/PNG.',
  draft_expired: 'O envio expirou. Prepara novamente a publicação.',
  publication_uncertain: 'Não foi possível confirmar o resultado. Verifica o teu LinkedIn antes de criar outra publicação.',
  post_changed: 'A publicação mudou. Prepara novamente a cópia.',
  processing_failed: 'O LinkedIn não conseguiu processar o vídeo.',
  linkedin_rejected: 'O LinkedIn recusou esta publicação. Verifica a conta e o conteúdo antes de tentar novamente.',
  rate_limited: 'Atingiste o limite de preparações nesta hora. Tenta mais tarde.',
};
export async function linkedinRequest(action: string, input?: Record<string, unknown>, binary?: { draft: string; part: number; blob: Blob }, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error(messages.unauthorized);
  const query = new URLSearchParams({ action, ...(binary ? { draft: binary.draft, part: String(binary.part) } : {}) });
  const read = ['status', 'draft'].includes(action);
  if (read && input?.draft) query.set('draft', String(input.draft));
  const response = await fetch(`/api/linkedin?${query}`, {
    method: read ? 'GET' : 'POST', credentials: 'same-origin', signal,
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
    body: read ? undefined : binary?.blob ?? JSON.stringify(input || {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(messages[result.error] || 'Não foi possível concluir a operação. Tenta novamente.');
  return result;
}
export async function connectLinkedIn() {
  const { url } = await linkedinRequest('connect', { returnPath: location.pathname + location.search });
  const destination = new URL(url);
  if (destination.origin !== 'https://www.linkedin.com' || destination.pathname !== '/oauth/v2/authorization') throw new Error('Destino de autorização inválido.');
  location.assign(destination.href);
}
