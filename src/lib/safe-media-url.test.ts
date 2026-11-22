import { describe, expect, it } from 'vitest';
import { safeMediaUrl } from './safe-media-url';

describe('untrusted stored media URLs', () => {
  it.each([
    'javascript:void(0)',
    'JaVaScRiPt:void(0)',
    'java\nscript:void(0)',
    'data:image/svg+xml,<svg/>',
    'file:///tmp/report.pdf',
    '//example.com/report.pdf',
    '/report.pdf',
    'https://trusted.example@other.example/report.pdf',
    'https://user:password@example.com/report.pdf',
    'https://example.com/\nreport.pdf',
    'chat-attachment://broken/../file.pdf',
    'blob:null/local-preview',
    'blob:https://other.example/local-preview',
  ])('rejects unsupported or deceptive references: %s', value => {
    expect(safeMediaUrl(value, 'https://www.yamilook.com')).toBeUndefined();
  });

  it('preserves HTTPS signatures and media fragments', () => {
    const value = 'https://example.supabase.co/storage/v1/object/sign/chat-attachments/file.mp4?token=a%2Fb&download=clip.mp4#t=0.1';
    expect(safeMediaUrl(value)).toBe(value);
  });

  it('keeps HTTP legacy media usable without trusting any other scheme', () => {
    expect(safeMediaUrl('http://example.com/legacy.jpg')).toBe('http://example.com/legacy.jpg');
  });

  it('requires a current origin for a locally generated voice blob', () => {
    const value = 'blob:https://www.yamilook.com/19fa8eb1-64d1-47b2-8df4-2f45dbade7f0';
    expect(safeMediaUrl(value, 'https://www.yamilook.com')).toBe(value);
    expect(safeMediaUrl(value)).toBeUndefined();
  });
});
