import { uiText } from '@/i18n/ui-copy';
import { chatMediaType } from './chat-media';
import { preparePostImage } from './post-image';

// Leave room below the storage service's common 50 MiB upload ceiling.
export const POST_VIDEO_PREPARE_THRESHOLD = 48 * 1024 * 1024;

export async function preparePostMedia(file: File, signal: AbortSignal, onProgress: (percent: number) => void = () => {}): Promise<File> {
  signal.throwIfAborted();
  if (chatMediaType(file) !== 'video') return preparePostImage(file);
  if (file.size <= POST_VIDEO_PREPARE_THRESHOLD) return file;
  onProgress(0);
  const { brandVideo } = await import('./branded-video');
  signal.throwIfAborted();
  // BlobSource reads slices from the selected file; no full-file download/copy.
  // No attribution is burned into the uploaded original's derived copy.
  const result = await brandVideo(file, null, signal, onProgress);
  signal.throwIfAborted();
  if (result.size > POST_VIDEO_PREPARE_THRESHOLD) throw new Error(uiText("O vídeo continua demasiado grande. Divide-o em partes mais curtas."));
  onProgress(100);
  return result;
}
