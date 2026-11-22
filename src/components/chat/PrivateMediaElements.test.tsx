import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatMediaLink } from './PrivateMediaElements';

const { createSignedUrl } = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ createSignedUrl }) } } }));
beforeEach(() => {
  createSignedUrl.mockReset();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it.each([
  'javascript:void(0)',
  'data:text/html,<p>untrusted document</p>',
  'file:///tmp/document.pdf',
  'https://trusted.example@other.example/document.pdf',
])('keeps an unsafe stored attachment URL out of the download link: %s', href => {
  const onClick = vi.fn();
  const { container } = render(<ChatMediaLink href={href} onClick={onClick}>Document</ChatMediaLink>);
  const anchor = container.querySelector('a')!;
  expect(anchor).not.toHaveAttribute('href');
  expect(anchor).toHaveAttribute('aria-disabled', 'true');
  expect(fireEvent.click(anchor)).toBe(false);
  expect(onClick).not.toHaveBeenCalled();
  expect(createSignedUrl).not.toHaveBeenCalled();
});

it('keeps a normal attachment usable and adds opener protection', () => {
  const href = 'https://example.supabase.co/storage/v1/object/public/media/report.pdf';
  render(<ChatMediaLink href={href} target="_blank">Document</ChatMediaLink>);
  expect(screen.getByRole('link', { name: 'Document' })).toHaveAttribute('href', href);
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
});
