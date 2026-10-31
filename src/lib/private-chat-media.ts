import { supabase } from '@/integrations/supabase/client';
export const PRIVATE_CHAT_PREFIX = 'chat-attachment://';
export function privateChatPath(reference: string): string | null {
  if (!reference.startsWith(PRIVATE_CHAT_PREFIX)) return null;
  const path = reference.slice(PRIVATE_CHAT_PREFIX.length);
  return path && !path.split('/').some(segment => segment === '..') && !/[?#]/.test(path) ? path : null;
}
export async function uploadPrivateChatFile(conversationId: string, file: Blob, filename: string, contentType: string): Promise<string> {
  if (file.size > 100 * 1024 * 1024) throw new Error('O limite por ficheiro é 100 MB');
  const { data, error } = await supabase.rpc('reserve_chat_attachment', { p_conversation_id: conversationId, p_filename: filename });
  const reservation = data as { path?: string; reference?: string } | null;
  if (error || !reservation?.path || !reservation.reference) throw new Error('Não foi possível autorizar o anexo');
  const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(reservation.path, file, {
    contentType, cacheControl: '0', upsert: false,
  });
  if (uploadError) throw new Error('Não foi possível carregar o anexo');
  return reservation.reference;
}
export async function signPrivateChatMedia(reference: string): Promise<string> {
  const path = privateChatPath(reference);
  if (!path) throw new Error('Referência privada inválida');
  const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error('Sem acesso ao anexo');
  return data.signedUrl;
}
