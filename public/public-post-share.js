(() => {
  // Browsers permit automatic playback without sound; sound requires a tap.
  document.querySelectorAll('.sound-toggle').forEach((button) => {
    const video = button.previousElementSibling;
    const update = () => {
      const label = video.muted ? 'Ativar som' : 'Silenciar';
      button.textContent = label;
      button.setAttribute('aria-label', label);
    };
    button.addEventListener('click', () => {
      video.muted = !video.muted;
      if (video.paused) video.play().catch(() => { /* Native play stays available. */ });
      update();
    });
    video.addEventListener('volumechange', update);
  });
  const dialog = document.getElementById('share-destinations');
  const status = { set textContent(value) { for (const id of ['share-status', 'dialog-share-status']) { const element = document.getElementById(id); if (element) element.textContent = value; } } };
  async function share(button, copyOnly) {
    const url = button.dataset.url;
    if (!url) return;
    button.disabled = true;
    try {
      if (!copyOnly && navigator.share) {
        await navigator.share({ title: document.title, url });
        status.textContent = 'Conclui a publicação na aplicação escolhida. A Yamilook não recebe confirmação de publicação.';
      } else {
        await navigator.clipboard.writeText(url);
        status.textContent = button.id === 'linkedin-copy' ? 'Ligação copiada. Abre a aplicação LinkedIn, toca em Publicar e cola a ligação.' : 'Ligação copiada.';
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        status.textContent = 'Partilha cancelada. Podes tentar novamente.';
      } else {
        status.textContent = 'Seleciona e copia a ligação abaixo para partilhar.';
        document.getElementById(dialog?.open ? 'dialog-post-url' : 'post-url')?.select();
      }
    } finally { button.disabled = false; }
  }
  document.querySelectorAll('[data-file-destination]').forEach(button => {
    button.addEventListener('click', () => { status.textContent = `Para publicar no ${button.dataset.fileDestination}, guarda a fotografia ou o vídeo e anexa-o nessa aplicação.`; });
  });
  document.getElementById('share-post')?.addEventListener('click', () => dialog?.showModal());
  document.getElementById('close-share')?.addEventListener('click', () => dialog?.close());
  document.getElementById('more-share')?.addEventListener('click', (event) => share(event.currentTarget, false));
  document.getElementById('dialog-copy-post')?.addEventListener('click', (event) => share(event.currentTarget, true));
  const linkedInShare = document.getElementById('linkedin-native-share');
  if (linkedInShare) linkedInShare.hidden = typeof navigator.share !== 'function';
  linkedInShare?.addEventListener('click', (event) => share(event.currentTarget, false));
  document.getElementById('linkedin-copy')?.addEventListener('click', (event) => share(event.currentTarget, true));
  document.getElementById('linkedin-prepare-video')?.addEventListener('click', () => {
    document.getElementById('video-sharing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const target = document.getElementById('send-video');
    (target && !target.hidden ? target : document.getElementById('prepare-video'))?.focus({ preventScroll: true });
  });
  document.getElementById('copy-post')?.addEventListener('click', (event) => share(event.currentTarget, true));
  document.getElementById('retry-post')?.addEventListener('click', () => location.reload());
})();
