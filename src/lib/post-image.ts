/** Prepare photos for upload, converting iPhone HEIC/HEIF to JPEG where the browser decoder supports it. */
export function isHeicImage(file: File): boolean {
  return /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type);
}

export async function preparePostImage(file: File): Promise<File> {
  const heic = isHeicImage(file);
  if (!heic && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  if (!heic && file.size < 200_000) return file;

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = url;
    });

    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const targetType = heic ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, targetType, 0.84));
    if (!blob || (heic && blob.type !== 'image/jpeg')) throw new Error('Image conversion unavailable');
    if (!heic && blob.size >= file.size) return file;

    const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + extension, {
      type: blob.type,
      lastModified: file.lastModified,
    });
  } catch (error) {
    if (heic) {
      // Never upload an unreadable HEIC file and then report a successful post.
      throw new Error('Não foi possível converter esta fotografia HEIC. No iPhone, partilhe-a como JPEG e volte a tentar.');
    }
    // Regular JPEG/PNG/WebP may still be uploaded unchanged if optimisation fails.
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
