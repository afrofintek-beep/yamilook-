(() => {
  const status = document.getElementById('share-status');
  async function share(button, copyOnly) {
    const url = button.dataset.url;
    if (!url) return;
    button.disabled = true;
    try {
      if (!copyOnly && navigator.share) {
        await navigator.share({ title: document.title, url });
        status.textContent = 'Partilha concluída.';
      } else {
        await navigator.clipboard.writeText(url);
        status.textContent = 'Ligação copiada.';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        status.textContent = 'Seleciona e copia a ligação abaixo para partilhar.';
        document.getElementById('post-url')?.select();
      }
    } finally { button.disabled = false; }
  }
  document.getElementById('share-post')?.addEventListener('click', (event) => share(event.currentTarget, false));
  document.getElementById('copy-post')?.addEventListener('click', (event) => share(event.currentTarget, true));
  document.getElementById('retry-post')?.addEventListener('click', () => location.reload());
})();
