import { supabase } from '@/integrations/supabase/client';
import { prepareOwnedMedia } from '../../shared/owned-post-media.mjs';

export interface OwnedMediaDescriptor { url: string; downloadUrl: string; filename: string; type: string }

export async function getOwnedMediaDescriptor(postId: string, index: number, signal?: AbortSignal): Promise<OwnedMediaDescriptor> {
  const { data, error } = await supabase.functions.invoke('owned-post-media', { body: { postId, index }, signal });
  signal?.throwIfAborted();
  if (error || !data?.url || !data?.downloadUrl || !data?.filename || !data?.type) {
    const status = error?.context?.status;
    throw new Error(status === 401 ? 'Entra novamente para partilhar os teus ficheiros.' : status === 404 ? 'Só podes enviar ficheiros das tuas próprias publicações disponíveis.' : 'Não foi possível preparar o ficheiro. Tenta novamente.');
  }
  return data;
}

export function prepareOwnedPostMedia(postId: string, index: number, options: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {}): Promise<File> {
  return prepareOwnedMedia(signal => getOwnedMediaDescriptor(postId, index, signal), options);
}
