// Shared by the React dialog and the progressively enhanced public viewer.
export const MAX_PREPARED_VIDEO_BYTES = 100 * 1024 * 1024;
const types = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
export function videoDescriptor(post, index, storageUrl) {
  if (!post || !/^(0|[1-9]\d*)$/.test(String(index))) return null;
  const source = post.media_urls[Number(index)];
  if (!source) return null;
  const url = new URL(source);
  const extension = /\.(mp4|m4v|mov|webm)$/i.exec(url.pathname)?.[1].toLowerCase();
  if (!extension || url.protocol !== 'https:' || url.username || url.password) return null;
  const filename = `yamilook-${post.id}-${Number(index) + 1}.${extension}`;
  const download = new URL(url);
  if (storageUrl && download.origin === new URL(storageUrl).origin && download.pathname.startsWith('/storage/v1/object/public/')) download.searchParams.set('download', filename);
  return { url: url.href, downloadUrl: download.href, filename, type: types[extension] };
}
export function videoEndpoint(id, index, download = false) {
  return `/api/public-post?${new URLSearchParams({ id, media: 'video', index: String(index), ...(download ? { download: '1' } : {}) })}`;
}
export async function preparePostVideo(id, index, { signal, onProgress = () => {}, fetcher = fetch } = {}) {
  const metadata = await fetcher(videoEndpoint(id, index), { signal, cache: 'no-store', credentials: 'omit' });
  if (!metadata.ok) throw new Error(metadata.status === 404 ? 'Esta publicação já não está disponível publicamente.' : 'Não foi possível preparar o vídeo. Tenta novamente.');
  const { url, filename, type } = await metadata.json();
  const source = new URL(url);
  if (source.protocol !== 'https:' || source.username || source.password || !Object.values(types).includes(type)) throw new Error('Formato de vídeo indisponível.');
  const response = await fetcher(source.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Não foi possível carregar o vídeo. Tenta novamente ou descarrega o ficheiro.');
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (mime && !mime.startsWith('video/') && !['application/octet-stream', 'binary/octet-stream'].includes(mime)) {
    await response.body?.cancel();
    throw new Error('O ficheiro recebido não é um vídeo.');
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const tooLarge = () => new Error('Este vídeo é grande para preparar no telemóvel. Usa Descarregar vídeo e anexa-o na aplicação.');
  if (total > MAX_PREPARED_VIDEO_BYTES) { await response.body?.cancel(); throw tooLarge(); }
  if (!response.body?.getReader) throw new Error('Usa Descarregar vídeo para guardar o ficheiro neste navegador.');
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > MAX_PREPARED_VIDEO_BYTES) throw tooLarge();
      chunks.push(value);
      onProgress(loaded, total);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  signal?.throwIfAborted();
  if (!loaded) throw new Error('O vídeo está vazio. Tenta novamente.');
  // Recheck public visibility after the transfer, before exposing the prepared file.
  const check = await fetcher(videoEndpoint(id, index), { signal, cache: 'no-store', credentials: 'omit' });
  if (!check.ok || (await check.json()).url !== source.href) throw new Error('A publicação foi alterada ou já não está disponível publicamente.');
  return new File(chunks, filename, { type });
}
export function canShareVideo(file, nav = navigator) {
  try { return !!(nav.share && nav.canShare?.({ files: [file] })); } catch { return false; }
}
// Must run directly in a fresh tap handler, after preparation; no fetch before share.
export async function sharePreparedVideo(file, nav = navigator) {
  if (!canShareVideo(file, nav)) return 'unsupported';
  try { await nav.share({ files: [file] }); return 'shared'; }
  catch (error) { if (error?.name === 'AbortError') return 'cancelled'; throw error; }
}
