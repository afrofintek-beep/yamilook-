/** Import address data only. Never follow QR links or import access credentials. */
export function addressFromCard(value: string): string | null {
  if (value.length > 2048) return null;
  let candidate = value.trim().replace(/[–—−]/g, '-');
  if (/^https:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (!['app.afroloc.ao', 'afroloc.ao', 'www.afroloc.ao', 'www.njilamaps.com', 'njilamaps.com'].includes(url.hostname) || url.port || url.username || url.password) return null;
      candidate = url.searchParams.get('code') || url.searchParams.get('afroloc') || '';
    } catch { return null; }
  }
  candidate = candidate.replace(/^AFROLOC\s*:\s*/i, '').trim().toUpperCase();
  return candidate.length <= 160 && /^[A-Z]{2}(?:-[A-Z0-9]+){2,}$/.test(candidate) ? candidate : null;
}

export async function readAfrolocCard(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolhe uma imagem JPG, PNG ou WebP do cartão. Também podes escrever o código abaixo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem deve ter até 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Não foi possível ler a imagem. Tenta outra fotografia ou escreve o código.')); image.src = url; });
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Não foi possível ler a imagem. Escreve o código abaixo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import('jsqr');
    const qr = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
    const code = qr && addressFromCard(qr.data);
    if (!code) throw new Error('Não foi encontrado um código de endereço legível no QR. Escreve o endereço impresso no cartão.');
    return code;
  } finally { URL.revokeObjectURL(url); }
}
