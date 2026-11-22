import { describe, expect, it } from 'vitest';
import { assertUploadAllowed, assertUploadMetadata, uploadObjectFilename } from './upload-safety';

describe('limited upload admission checks', () => {
  it.each([
    ['invoice.EXE', 'application/octet-stream'],
    ['invoice.exe.pdf', 'application/pdf'],
    ['photo.svg.jpg', 'image/jpeg'],
    ['photo.jpg', 'image/svg+xml'],
    ['photo.jpg', 'text/html; charset=utf-8'],
    ['photo.jpg', 'application/x-msdownload'],
    ['invoice.docm', 'application/octet-stream'],
    ['invoice.xlsx', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
    ['invoice．exe．pdf', 'application/pdf'],
    ['install.apk', 'application/octet-stream'],
    ['page.html', 'application/octet-stream'],
  ])('rejects active/executable metadata: %s (%s)', (name, type) => {
    expect(() => assertUploadMetadata(name, type)).toThrow();
  });

  it.each(['../../photo.jpg', 'photo\\file.jpg', 'photo\u0000.exe.jpg', 'photo\n.jpg', 'photo\u202egpj.exe', 'photo.jpg ', 'photo.jpg.', ''])('rejects misleading filenames: %j', name => {
    expect(() => assertUploadMetadata(name, 'image/jpeg')).toThrow();
  });

  it('checks the original blob MIME even when a caller supplies a different one', async () => {
    await expect(assertUploadAllowed(new Blob(['image'], { type: 'image/svg+xml' }), 'photo.jpg', 'image/jpeg')).rejects.toThrow();
    await expect(assertUploadAllowed(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), 'photo.jpg', 'image/jpeg')).rejects.toThrow(/formato/);
    await expect(assertUploadAllowed(new Blob(['audio fixture'], { type: 'audio/aac' }), 'audio.m4a', 'audio/mp4')).resolves.toBeUndefined();
  });

  it.each([
    ['photo.jpg', 'application/pdf'], ['document.pdf', 'image/jpeg'],
    ['clip.mov', 'text/plain'], ['photo.png', 'image/jpeg'],
  ])('rejects a known MIME and extension conflict: %s / %s', (name, type) => {
    expect(() => assertUploadMetadata(name, type)).toThrow(/formato/);
  });

  it.each([
    ['photo.HEIC', ''], ['photo.heif', 'application/octet-stream'],
    ['clip.MOV', 'video/quicktime'], ['clip.mp4', 'video/mp4'],
    ['audio.webm', 'audio/webm;codecs=opus'], ['audio.ogg', 'audio/ogg;codecs=opus'],
    ['audio.m4a', 'audio/mp4'], ['audio.mp4', 'audio/mp4'], ['image.jpg', 'image/jpeg'],
    ['document.pdf', 'application/pdf'],
    ['document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['archive.zip', 'application/zip'], ['README', 'text/plain'],
  ])('preserves ordinary existing media and documents: %s', async (name, type) => {
    await expect(assertUploadAllowed(new Blob(['synthetic ordinary fixture']), name, type)).resolves.toBeUndefined();
  });

  // Only harmless signature/header bytes are used, never executable programs.
  it.each([
    [0x4d, 0x5a, 0, 0], [0x7f, 0x45, 0x4c, 0x46], [0, 0x61, 0x73, 0x6d],
    [0xca, 0xfe, 0xba, 0xbe], [0xcf, 0xfa, 0xed, 0xfe],
  ])('rejects a known executable signature hidden as a JPEG: %j', async (...signature) => {
    await expect(assertUploadAllowed(new Blob([new Uint8Array(signature)]), 'photo.jpg', 'image/jpeg')).rejects.toThrow();
  });

  it.each([
    '<!DOCTYPE html><html></html>', '<script></script>',
    '\ufeff \n<!-- cover --><svg></svg>', '<?xml version="1.0"?><svg></svg>',
    '#!/bin/sh\n# harmless fixture',
  ])('rejects active document headers renamed as images: %j', async text => {
    await expect(assertUploadAllowed(new Blob([text]), 'photo.png', 'image/png')).rejects.toThrow();
  });

  it('detects a UTF-16 HTML header with a BOM', async () => {
    const chars = Array.from('<html></html>', char => char.charCodeAt(0));
    const bytes = new Uint8Array([0xff, 0xfe, ...chars.flatMap(char => [char, 0])]);
    await expect(assertUploadAllowed(new Blob([bytes]), 'photo.jpg', 'image/jpeg')).rejects.toThrow();
  });

  it('does not call a permitted PDF scanned or parse its embedded contents', async () => {
    await expect(assertUploadAllowed(new Blob(['%PDF-1.7\nsynthetic <script> documentation']), 'document.pdf', 'application/pdf')).resolves.toBeUndefined();
  });

  it('rejects empty data', async () => {
    await expect(assertUploadAllowed(new Blob(), 'photo.jpg', 'image/jpeg')).rejects.toThrow(/vazio/);
  });

  it('creates an opaque object filename, preserving only a simple extension', () => {
    const name = uploadObjectFilename('private-photo.MOV');
    expect(name).toMatch(/^[0-9a-f-]{36}\.mov$/);
    expect(name).not.toContain('private-photo');
    expect(uploadObjectFilename('README')).toMatch(/\.bin$/);
  });
});
