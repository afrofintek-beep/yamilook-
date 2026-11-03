import type { ExportIdentity } from './owned-post-media';

const MAX_PIXELS = 24_000_000;
export const EXPORT_LIMIT = 100 * 1024 * 1024;
export function fitMedia(width: number, height: number, max = 1280) {
  if (!width || !height || !Number.isFinite(width * height)) throw new Error('Dimensões inválidas.');
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}
export async function loadBrandLogo(signal?: AbortSignal) {
  const response = await fetch('/yamilook-logo.png', { signal });
  if (!response.ok) throw new Error('Não foi possível carregar o logótipo.');
  return createImageBitmap(await response.blob());
}
function canvasFor(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não permite preparar imagens.');
  return { canvas, ctx };
}
export function drawBrand(ctx: CanvasRenderingContext2D, width: number, band: number, logo: ImageBitmap, identity: ExportIdentity) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, band);
  const margin = width * .035, logoWidth = width * .25;
  ctx.drawImage(logo, margin, (band - logoWidth * logo.height / logo.width) / 2, logoWidth, logoWidth * logo.height / logo.width);
  const left = width * .34;
  ctx.fillStyle = '#171719'; ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.max(12, width * .024)}px sans-serif`;
  ctx.fillText(identity.author.name, left, band * .32, width - left - margin);
  ctx.font = `${Math.max(10, width * .019)}px sans-serif`;
  ctx.fillText(identity.author.username ? `@${identity.author.username}` : 'Publicado na Yamilook', left, band * .64, width - left - margin);
}
async function toFile(canvas: HTMLCanvasElement, name: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Não foi possível exportar a imagem.')), 'image/jpeg', .94));
  signal?.throwIfAborted();
  return new File([blob], name, { type: 'image/jpeg' });
}
export async function brandImage(file: File, identity: ExportIdentity, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  // Animated files must not silently become a single still frame.
  if (file.type === 'image/gif') throw new Error('Para preservar a animação, usa a opção de ficheiro original abaixo.');
  const bitmap = await createImageBitmap(file);
  let logo: ImageBitmap | undefined;
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('A fotografia é demasiado grande para este dispositivo. Usa o ficheiro original.');
    logo = await loadBrandLogo(signal);
    const { width, height } = fitMedia(bitmap.width, bitmap.height, 1600);
    const band = Math.ceil(width * .14 / 2) * 2;
    const { canvas, ctx } = canvasFor(width, height + band);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height + band);
    ctx.drawImage(bitmap, 0, band, width, height);
    drawBrand(ctx, width, band, logo, identity);
    return await toFile(canvas, 'fotografia-yamilook.jpg', signal);
  } finally { bitmap.close(); logo?.close(); }
}
/** Wrap without losing characters, including long URLs and explicit line breaks. */
export function wrapText(text: string, measure: (text: string) => number, width: number): string[] {
  return text.split('\n').flatMap(paragraph => {
    const lines: string[] = []; let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > width) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line); return lines;
  });
}
export async function brandText(identity: ExportIdentity, signal?: AbortSignal): Promise<File[]> {
  if (!identity.content.trim()) throw new Error('Esta publicação não tem texto para criar um cartão.');
  const logo = await loadBrandLogo(signal);
  try {
    const { canvas, ctx } = canvasFor(1080, 1350);
    ctx.font = '36px sans-serif';
    const lines = wrapText(identity.content, value => ctx.measureText(value).width, 944);
    const pages = Math.ceil(lines.length / 20);
    if (pages > 30) throw new Error('O texto é demasiado longo para exportar neste dispositivo.');
    const files: File[] = [];
    for (let page = 0; page < pages; page++) {
      signal?.throwIfAborted();
      ctx.fillStyle = '#171719'; ctx.fillRect(0, 0, 1080, 1350);
      drawBrand(ctx, 1080, 164, logo, identity);
      ctx.fillStyle = '#ffffff'; ctx.font = '36px sans-serif'; ctx.textBaseline = 'top';
      lines.slice(page * 20, (page + 1) * 20).forEach((line, i) => ctx.fillText(line, 68, 224 + i * 49));
      ctx.fillStyle = '#e0b74b'; ctx.font = '26px sans-serif';
      ctx.fillText(`Publicado na Yamilook · ${page + 1}/${pages}`, 68, 1270);
      files.push(await toFile(canvas, `cartao-yamilook-${page + 1}.jpg`, signal));
    }
    return files;
  } finally { logo.close(); }
}
