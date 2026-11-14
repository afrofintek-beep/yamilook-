import { uiText } from '@/i18n/ui-copy';
/** Translate only the known application messages, never arbitrary file contents. */
export function cardImportText(message: string): string {
 switch (message) {
  case "A imagem deve ter até 10 MB.": return uiText("A imagem deve ter até 10 MB.");
  case "Código lido. Confirma o endereço antes de guardar a Banda.": return uiText("Código lido. Confirma o endereço antes de guardar a Banda.");
  case "Escolhe uma imagem JPG, PNG ou WebP do cartão. Também podes escrever o código abaixo.": return uiText("Escolhe uma imagem JPG, PNG ou WebP do cartão. Também podes escrever o código abaixo.");
  case "Não foi encontrado um código de endereço legível no QR. Escreve o endereço impresso no cartão.": return uiText("Não foi encontrado um código de endereço legível no QR. Escreve o endereço impresso no cartão.");
  case "Não foi possível ler a imagem. Escreve o código abaixo.": return uiText("Não foi possível ler a imagem. Escreve o código abaixo.");
  case "Não foi possível ler a imagem. Tenta outra fotografia ou escreve o código.": return uiText("Não foi possível ler a imagem. Tenta outra fotografia ou escreve o código.");
  default: return uiText("Não foi possível ler a imagem. Escreve o código abaixo.");
 }
}
