import {readCardReference,type CardReference} from '../shared/afroloc-card/protocol';
export function addressFromCard(value:string):string|null{const ref=readCardReference(value);return ref?.kind==='address'?ref.code:null;}

export async function readAfrolocCardReference(file: File): Promise<CardReference> {
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
    const reference = qr && readCardReference(qr.data);
    if (!reference) throw new Error('Não foi encontrado um código de endereço legível no QR. Escreve o endereço impresso no cartão.');
    return reference;
  } finally { URL.revokeObjectURL(url); }
}

/** Legacy address importer never converts protected access into an address code. */
export async function readAfrolocCard(file:File):Promise<string>{
 const reference=await readAfrolocCardReference(file);
 if(reference.kind!=='address')throw new Error('Não foi encontrado um código de endereço legível no QR. Escreve o endereço impresso no cartão.');
 return reference.code;
}
