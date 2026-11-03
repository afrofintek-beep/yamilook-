import { getOwnedMediaDescriptor, type ExportIdentity } from './owned-post-media';

export async function prepareOwnedVideoExport(postId: string, index: number, options: {
  signal: AbortSignal; identity?: ExportIdentity; onProgress?: (progress: number) => void;
}): Promise<File> {
  const descriptor = await getOwnedMediaDescriptor(postId, index, options.signal);
  if (!descriptor.type.startsWith('video/')) throw new Error('O ficheiro selecionado não é um vídeo.');
  const { brandVideo } = await import('./branded-video');
  options.signal.throwIfAborted();
  const result = await brandVideo(descriptor.url, options.identity ?? null, options.signal, options.onProgress ?? (() => {}));
  const current = await getOwnedMediaDescriptor(postId, index, options.signal);
  options.signal.throwIfAborted();
  if (current.url !== descriptor.url || current.type !== descriptor.type) throw new Error('A publicação mudou. Prepara novamente a cópia.');
  return result;
}
