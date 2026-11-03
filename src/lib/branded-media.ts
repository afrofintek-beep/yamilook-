/** Export a visual copy; the source file and publication audience are untouched. */
export async function brandImage(file: File, author: string, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(file);
  try {
    const width = Math.min(1600, bitmap.width);
    const height = Math.round(bitmap.height * width / bitmap.width);
    const band = Math.max(100, Math.round(width * .12));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height + band;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a imagem.');
    ctx.fillStyle = '#171719'; ctx.fillRect(0, 0, width, height + band);
    ctx.drawImage(bitmap, 0, band, width, height);
    ctx.fillStyle = '#e0b74b'; ctx.font = `bold ${Math.round(band * .29)}px sans-serif`;
    ctx.fillText('yamilook', band * .22, band * .4);
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(band * .22)}px sans-serif`;
    ctx.fillText(author.trim().slice(0, 80), band * .22, band * .76, width - band * .44);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível exportar a imagem.')), 'image/jpeg', .94));
    signal?.throwIfAborted();
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-yamilook.jpg', { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}
