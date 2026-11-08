import { uiText } from '@/i18n/ui-copy';
import type { ExportIdentity } from './owned-post-media';
import { YAMILOOK_LOGO_LIGHT, YAMILOOK_LOGO_DARK } from './brand-assets';

const MAX_PIXELS = 24_000_000;
export const EXPORT_LIMIT = 100 * 1024 * 1024;
export function fitMedia(width: number, height: number, max = 1280) {
  if (!width || !height || !Number.isFinite(width * height)) throw new Error(uiText("Dimensões inválidas."));
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}
export async function loadBrandLogo(signal?: AbortSignal, overlay = false) {
  const response = await fetch(overlay ? YAMILOOK_LOGO_DARK : YAMILOOK_LOGO_LIGHT, { signal });
  if (!response.ok) throw new Error(uiText("Não foi possível carregar o logótipo."));
  return createImageBitmap(await response.blob());
}
/** Burn the same light wordmark used by the app into the media's own pixels. */
export function drawMediaBrand(ctx: CanvasRenderingContext2D, width: number, height: number, logo: ImageBitmap, identity: ExportIdentity) {
  const band = Math.min(height * .3, width * .22);
  const margin = width * .035;
  const logoWidth = Math.min(width * .3, band * logo.width / logo.height);
  const logoHeight = logoWidth * logo.height / logo.width;
  ctx.save();
  const shade = ctx.createLinearGradient(0, height - band, 0, height);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = shade; ctx.fillRect(0, height - band, width, band);
  // Match the app's screen blend: hide the asset's black background, retain
  // its white lettering and gold stroke without drawing a rectangular badge.
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(logo, margin, height - (band + logoHeight) / 2, logoWidth, logoHeight);
  ctx.globalCompositeOperation = 'source-over';
  const left = width * .37;
  const fontSize = Math.min(width * .024, band * .19);
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000000'; ctx.shadowBlur = 4;
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.fillText(identity.author.name, left, height - band * .53, width - left - margin);
  ctx.font = `${fontSize * .8}px sans-serif`;
  ctx.fillText(identity.author.username ? `@${identity.author.username}` : 'Publicado na Yamilook', left, height - band * .30, width - left - margin);
  ctx.restore();
}
function canvasFor(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(uiText("Este navegador não permite preparar imagens."));
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
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error(uiText("Não foi possível exportar a imagem."))), 'image/jpeg', .94));
  signal?.throwIfAborted();
  return new File([blob], name, { type: 'image/jpeg' });
}
export async function brandImage(file: File, identity: ExportIdentity, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  // Animated files must not silently become a single still frame.
  if (file.type === 'image/gif') throw new Error(uiText("Para preservar a animação, usa a opção de ficheiro original abaixo."));
  const bitmap = await createImageBitmap(file);
  let logo: ImageBitmap | undefined;
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error(uiText("A fotografia é demasiado grande para este dispositivo. Usa o ficheiro original."));
    logo = await loadBrandLogo(signal, true);
    const { width, height } = fitMedia(bitmap.width, bitmap.height, 1600);
    const { canvas, ctx } = canvasFor(width, height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    drawMediaBrand(ctx, width, height, logo, identity);
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
  if (!identity.content.trim()) throw new Error(uiText("Esta publicação não tem texto para criar um cartão."));
  const logo = await loadBrandLogo(signal);
  try {
    const { canvas, ctx } = canvasFor(1080, 1350);
    ctx.font = '36px sans-serif';
    const lines = wrapText(identity.content, value => ctx.measureText(value).width, 944);
    const pages = Math.ceil(lines.length / 20);
    if (pages > 30) throw new Error(uiText("O texto é demasiado longo para exportar neste dispositivo."));
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
