import { preparePostVideo, canShareVideo, sharePreparedVideo, videoEndpoint } from './public-video-sharing.mjs';
const section = document.getElementById('video-sharing');
if (section) {
  const id = section.dataset.postId;
  let index = Number(section.dataset.index);
  let file = null;
  let request = null;
  let sharing = false;
  const prepare = document.getElementById('prepare-video');
  const send = document.getElementById('send-video');
  const cancel = document.getElementById('cancel-video');
  const download = document.getElementById('download-video');
  const select = document.getElementById('share-video-index');
  const status = document.getElementById('video-share-status');
  const update = () => {
    prepare.hidden = !!file; prepare.disabled = !!request || sharing;
    send.hidden = !file || !canShareVideo(file); send.disabled = sharing;
    cancel.hidden = !request;
    if (select) select.disabled = sharing;
    download.href = videoEndpoint(id, index, true);
  };
  const reset = () => { request?.abort(); request = null; file = null; status.textContent = ''; update(); };
  document.getElementById('share-destinations').addEventListener('close', reset);
  window.addEventListener('pagehide', reset);
  select?.addEventListener('change', () => { reset(); index = Number(select.value); update(); });
  cancel.addEventListener('click', () => { reset(); status.textContent = 'Preparação cancelada.'; });
  prepare.addEventListener('click', async () => {
    if (request) return;
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 120000);
    status.textContent = 'A preparar vídeo…'; update();
    try {
      const result = await preparePostVideo(id, index, { signal: controller.signal, onProgress: (loaded, total) => {
        status.textContent = total ? `A preparar vídeo… ${Math.min(100, Math.round(loaded / total * 100))}%` : `A preparar vídeo… ${(loaded / 1048576).toFixed(1)} MB`;
      } });
      if (request === controller && !controller.signal.aborted) {
        file = result;
        status.textContent = canShareVideo(file) ? 'Vídeo pronto. Toca em Escolher aplicação.' : 'Este navegador não partilha ficheiros diretamente. Descarrega o vídeo para o publicar.';
      }
    } catch (error) { if (request === controller) status.textContent = controller.signal.aborted ? 'Preparação interrompida. Tenta novamente ou descarrega o vídeo.' : error.message; }
    finally { clearTimeout(timeout); if (request === controller) { request = null; update(); } }
  });
  send.addEventListener('click', async () => {
    if (!file || sharing) return;
    sharing = true; update();
    try {
      const result = await sharePreparedVideo(file);
      status.textContent = result === 'shared' ? 'Vídeo entregue à aplicação. Conclui a publicação nessa aplicação.' : result === 'cancelled' ? 'Partilha cancelada. O vídeo continua pronto.' : 'Descarrega o vídeo e anexa-o numa publicação.';
    } catch { status.textContent = 'Não foi possível abrir a partilha. Tenta novamente ou descarrega o vídeo.'; }
    finally { sharing = false; update(); }
  });
}
