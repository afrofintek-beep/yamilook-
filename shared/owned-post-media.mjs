// No credentials or database access: shared by the owner endpoint and browser.
export const MAX_OWNED_MEDIA_BYTES = 100 * 1024 * 1024;
const types = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
};

export function mediaKind(source) {
  try {
    const extension = new URL(source).pathname.split('.').pop().toLowerCase();
    return types[extension]?.split('/')[0] || null;
  } catch { return null; }
}

export function ownedMediaDescriptor(post, index, storageUrl) {
  if (!Number.isSafeInteger(index) || index < 0 || !Array.isArray(post?.media_urls)) return null;
  try {
    const url = new URL(post.media_urls[index]);
    // Only return this project's existing feed media, never arbitrary destinations
    // or chat attachment URLs. No signing, publication or storage policy changes.
    if (url.protocol !== 'https:' || url.origin !== new URL(storageUrl).origin ||
        url.username || url.password || !url.pathname.startsWith('/storage/v1/object/public/media/')) return null;
    const extension = url.pathname.split('.').pop().toLowerCase();
    if (!types[extension]) return null;
    const filename = `yamilook-${post.id}-${index + 1}.${extension}`;
    const download = new URL(url);
    download.searchParams.set('download', filename);
    return { url: url.href, downloadUrl: download.href, filename, type: types[extension] };
  } catch { return null; }
}

export async function prepareOwnedMedia(getDescriptor, { signal, onProgress = () => {}, fetcher = fetch } = {}) {
  const descriptor = await getDescriptor(signal);
  const source = new URL(descriptor.url);
  if (source.protocol !== 'https:' || source.username || source.password || !Object.values(types).includes(descriptor.type)) {
    throw new Error('Formato de ficheiro indisponível.');
  }
  const response = await fetcher(source.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar o ficheiro. Tenta novamente.');
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (mime && !Object.values(types).includes(mime) && !['application/octet-stream', 'binary/octet-stream'].includes(mime)) {
    await response.body?.cancel();
    throw new Error('O ficheiro recebido não é uma fotografia ou um vídeo.');
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const tooLarge = () => new Error('Este ficheiro é grande para preparar no telemóvel. Usa Descarregar ficheiro e anexa-o na aplicação.');
  if (total > MAX_OWNED_MEDIA_BYTES) { await response.body?.cancel(); throw tooLarge(); }
  if (!response.body?.getReader) throw new Error('Usa Descarregar ficheiro neste navegador.');
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > MAX_OWNED_MEDIA_BYTES) throw tooLarge();
      chunks.push(value);
      onProgress(loaded, total);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  signal?.throwIfAborted();
  if (!loaded) throw new Error('O ficheiro está vazio. Tenta novamente.');
  // Revalidate ownership, session, moderation and media selection after transfer.
  const current = await getDescriptor(signal);
  if (current.url !== descriptor.url || current.type !== descriptor.type) throw new Error('A publicação foi alterada. Prepara o ficheiro novamente.');
  signal?.throwIfAborted();
  return new File(chunks, descriptor.filename, { type: descriptor.type });
}
