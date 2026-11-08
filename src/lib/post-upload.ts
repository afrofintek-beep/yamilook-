import { uiText } from '@/i18n/ui-copy';
import { supabase } from '@/integrations/supabase/client';
import { chatMediaContentType } from './chat-media';
import { Upload } from 'tus-js-client';

export function postUploadEndpoint(projectUrl: string): string {
  const url = new URL(projectUrl);
  if (/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) url.hostname = url.hostname.replace('.supabase.co', '.storage.supabase.co');
  return new URL('/storage/v1/upload/resumable', url).href;
}

/** Retry interrupted chunks, report actual bytes, and never leave the composer waiting forever. */
export function uploadPostFile(file: File, path: string, options: { signal?: AbortSignal; onProgress?: (percent: number) => void } = {}): Promise<void> {
  options.signal?.throwIfAborted();
  if (!file.size) return Promise.reject(new Error(uiText("O ficheiro está vazio. Seleciona-o novamente.")));
  const endpoint = postUploadEndpoint(import.meta.env.VITE_SUPABASE_URL);
  return new Promise((resolve, reject) => {
    let upload: Upload | undefined;
    let settled = false;
    let idleTimer: ReturnType<typeof setTimeout>;
    let lastBytes = -1;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer); clearTimeout(totalTimer);
      options.signal?.removeEventListener('abort', cancel);
      if (error) { void upload?.abort().catch(() => undefined); reject(error); }
      else { options.onProgress?.(100); resolve(); }
    };
    const touch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => finish(new Error(uiText("O envio ficou sem resposta. Verifica a ligação e tenta publicar novamente; o texto e o ficheiro foram mantidos."))), 120_000);
    };
    const cancel = () => finish(new DOMException('Envio cancelado.', 'AbortError'));
    const totalTimer = setTimeout(() => finish(new Error(uiText("O envio demorou demasiado. Tenta novamente com uma ligação mais estável."))), 30 * 60_000);
    options.signal?.addEventListener('abort', cancel, { once: true });
    touch();
    try {
    upload = new Upload(file, {
      endpoint,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      metadata: { bucketName: 'media', objectName: path, contentType: chatMediaContentType(file), cacheControl: '31536000' },
      onBeforeRequest: async request => {
        if (new URL(request.getURL()).origin !== new URL(endpoint).origin) throw new Error(uiText("Destino de envio inválido."));
        const { data: { session }, error } = await supabase.auth.getSession();
        if (settled || options.signal?.aborted) throw new DOMException('Envio cancelado.', 'AbortError');
        if (error || !session?.access_token) throw new Error(uiText("A sessão expirou. Entra novamente para publicar."));
        request.setHeader('authorization', `Bearer ${session.access_token}`);
        request.setHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        request.setHeader('x-upsert', 'false');
      },
      onShouldRetry: error => {
        const status = error.originalResponse?.getStatus() || 0;
        return !settled && (status === 0 || status === 409 || status === 429 || status >= 500);
      },
      onProgress: (sent, total) => {
        if (settled) return;
        if (sent !== lastBytes) { lastBytes = sent; touch(); }
        // 100% means the server has acknowledged the complete file, not just sent bytes.
        options.onProgress?.(Math.min(99, Math.floor(sent / total * 100)));
      },
      onError: error => {
        const status = 'originalResponse' in error ? error.originalResponse?.getStatus() : undefined;
        finish(new Error(status === 413 ? 'Este ficheiro excede o limite de envio. Reduz o tamanho do vídeo e tenta novamente.'
          : status === 401 || status === 403 ? 'Não foi possível autorizar o envio. Entra novamente e tenta publicar.'
          : 'Não foi possível enviar o ficheiro. Verifica a ligação e tenta novamente; o texto e o ficheiro foram mantidos.'));
      },
      onSuccess: () => finish(),
    });
    upload.start();
    } catch (error) { finish(error instanceof Error ? error : new Error(uiText("Não foi possível iniciar o envio."))); }
  });
}
