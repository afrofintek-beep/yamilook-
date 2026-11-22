import { uiText } from '@/i18n/ui-copy';

/**
 * Limited, client-side upload admission checks. This is NOT an antivirus scan:
 * direct API callers can bypass it, and PDFs/Office files/archives may still
 * contain malicious content. Server quarantine and scanning are required before
 * an upload can be described as scanned or released on that basis.
 */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'com', 'scr', 'msi', 'msp', 'cpl', 'sys', 'drv', 'ocx',
  'bat', 'cmd', 'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'wsf', 'wsh', 'hta',
  'js', 'mjs', 'cjs', 'jse', 'sh', 'bash', 'zsh', 'fish', 'py', 'pyw',
  'php', 'phtml', 'pl', 'rb', 'jar', 'class', 'wasm', 'apk', 'aab', 'ipa',
  'app', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'lnk', 'url', 'scf', 'reg',
  'html', 'htm', 'shtml', 'xhtml', 'svg', 'svgz', 'swf',
  'docm', 'dotm', 'xlsm', 'xltm', 'xlam', 'xlsb', 'pptm', 'potm', 'ppam', 'ppsm', 'sldm',
]);

const BLOCKED_MIMES = new Set([
  'text/html', 'application/xhtml+xml', 'image/svg+xml', 'application/javascript',
  'text/javascript', 'application/x-javascript', 'text/jscript',
  'application/ecmascript', 'text/ecmascript', 'application/wasm',
  'application/x-sh', 'application/x-shellscript', 'application/x-php',
  'application/x-msdownload', 'application/x-msdos-program', 'application/x-dosexec',
  'application/vnd.microsoft.portable-executable', 'application/x-executable',
  'application/x-mach-binary', 'application/java-archive', 'application/java-vm',
  'application/vnd.android.package-archive', 'application/x-apple-diskimage',
  'application/x-shockwave-flash', 'application/hta',
]);

// Known pairs prevent an active/foreign MIME being attached to an otherwise
// familiar extension. Missing MIME and octet-stream remain common on iPhone.
const EXTENSION_MIMES: Record<string, readonly string[]> = {
  jpg: ['image/jpeg', 'image/pjpeg', 'image/jpg'], jpeg: ['image/jpeg', 'image/pjpeg', 'image/jpg'],
  png: ['image/png', 'image/x-png'], gif: ['image/gif'], webp: ['image/webp'], avif: ['image/avif'],
  heic: ['image/heic', 'image/heic-sequence', 'image/heif'],
  heif: ['image/heif', 'image/heif-sequence', 'image/heic'],
  mov: ['video/quicktime', 'video/mp4'], mp4: ['video/mp4', 'audio/mp4', 'application/mp4'],
  m4v: ['video/mp4', 'video/x-m4v'], webm: ['video/webm', 'audio/webm'],
  ogv: ['video/ogg', 'application/ogg'], '3gp': ['video/3gpp', 'audio/3gpp'],
  mp3: ['audio/mpeg', 'audio/mp3'], m4a: ['audio/mp4', 'audio/x-m4a', 'audio/aac'],
  aac: ['audio/aac', 'audio/x-aac'], ogg: ['audio/ogg', 'video/ogg', 'application/ogg'],
  opus: ['audio/ogg', 'audio/opus'], wav: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  flac: ['audio/flac', 'audio/x-flac'], pdf: ['application/pdf'], txt: ['text/plain'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  doc: ['application/msword'], xls: ['application/vnd.ms-excel'],
  ppt: ['application/vnd.ms-powerpoint'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
};

const mimeBase = (type: string) => type.split(';', 1)[0].trim().toLowerCase();

/** Only these locally authored messages may be shown directly to the sender. */
export class UploadAdmissionError extends Error {}
// Resolve the current locale at rejection time; keep translation sources literal.
const blockedFileError = () => new UploadAdmissionError(uiText('Este tipo de ficheiro não é permitido. Escolhe uma fotografia, vídeo, áudio ou documento compatível.'));

/** Reject misleading filenames before they enter a storage path or reservation. */
export function assertUploadMetadata(filename: string, contentType: string, blobType = ''): void {
  const name = filename.normalize('NFKC');
  if (!name || name.length > 255 || name !== name.trim() || /[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name) || name.endsWith('.')) {
    throw new UploadAdmissionError(uiText('O nome do ficheiro não é válido. Altera o nome e tenta novamente.'));
  }
  const parts = name.toLowerCase().split('.');
  // Include intermediate extensions: invoice.exe.pdf must not hide an executable.
  if (parts.slice(1).some(part => BLOCKED_EXTENSIONS.has(part))) throw blockedFileError();
  for (const value of [contentType, blobType]) {
    const mime = mimeBase(value);
    if (BLOCKED_MIMES.has(mime) || mime.includes('macroenabled')) throw blockedFileError();
  }
  const extension = parts.length > 1 ? parts[parts.length - 1] : '';
  const compatible = EXTENSION_MIMES[extension];
  for (const value of [contentType, blobType]) {
    const mime = mimeBase(value);
    if (mime && mime !== 'application/octet-stream' && compatible && !compatible.includes(mime)) {
      throw new UploadAdmissionError(uiText('O formato do ficheiro não corresponde ao nome. Escolhe o ficheiro original.'));
    }
  }
}

async function readHeader(file: Blob): Promise<Uint8Array> {
  const header = file.slice(0, 4096);
  if (typeof header.arrayBuffer === 'function') return new Uint8Array(await header.arrayBuffer());
  // Older WebViews still support FileReader without Blob.arrayBuffer.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reader.onabort = () => reject(new UploadAdmissionError(uiText('Não foi possível verificar o ficheiro. Seleciona-o novamente.')));
    reader.readAsArrayBuffer(header);
  });
}

/** Reject a small set of unambiguous executable/active-document signatures. */
function hasBlockedHeader(bytes: Uint8Array): boolean {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x4d, 0x5a) || starts(0x7f, 0x45, 0x4c, 0x46) || starts(0, 0x61, 0x73, 0x6d)
    || starts(0xca, 0xfe, 0xba, 0xbe) || starts(0xce, 0xfa, 0xed, 0xfe)
    || starts(0xcf, 0xfa, 0xed, 0xfe) || starts(0xfe, 0xed, 0xfa, 0xce)
    || starts(0xfe, 0xed, 0xfa, 0xcf)) return true;
  const encoding = starts(0xff, 0xfe) || starts(0x3c, 0) ? 'utf-16le'
    : starts(0xfe, 0xff) || starts(0, 0x3c) ? 'utf-16be' : 'utf-8';
  const text = new TextDecoder(encoding).decode(bytes).trimStart();
  return text.startsWith('#!') || /^\s*(?:(?:<!--[\s\S]*?-->|<\?xml[\s\S]*?\?>)\s*)*(?:<!doctype\s+html\b|<\/?(?:html|head|body|script|iframe|svg|object|embed)\b)/i.test(text);
}

export async function assertUploadAllowed(file: Blob, filename: string, contentType: string): Promise<void> {
  assertUploadMetadata(filename, contentType, file.type);
  if (!file.size) throw new UploadAdmissionError(uiText('O ficheiro está vazio. Seleciona-o novamente.'));
  if (hasBlockedHeader(await readHeader(file))) throw blockedFileError();
}

/** Storage keys never contain the original display filename. */
export function uploadObjectFilename(filename: string): string {
  const extension = filename.normalize('NFKC').split('.').slice(1).pop()?.toLowerCase();
  return `${crypto.randomUUID()}.${extension && /^[a-z0-9]{1,10}$/.test(extension) ? extension : 'bin'}`;
}
