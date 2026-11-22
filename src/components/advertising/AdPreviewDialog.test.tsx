import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Advertisement } from '@/hooks/useAdvertising';
import { AdPreviewDialog } from './AdPreviewDialog';

vi.mock('@/hooks/useAdvertising', () => ({ useAdvertising: () => ({ updateAdvertisement: vi.fn() }) }));
beforeEach(() => { vi.spyOn(window, 'open').mockReturnValue(null); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function show(cta_url: string, website?: string) {
  const ad = { id: 'ad', title: 'Business', total_budget: 100, call_to_action: 'Abrir loja', cta_url, business: { website } } as Advertisement;
  render(<AdPreviewDialog open onOpenChange={vi.fn()} ad={ad} businessProfile={null} onConfirmActivate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir loja' }));
}

it('does not execute an unsafe URL from an advertisement preview', () => {
  show('javascript:void(0)');
  expect(window.open).not.toHaveBeenCalled();
});

it('uses the same validated destination as the published business cards', () => {
  show('data:text/html,<p>untrusted</p>', 'example.ao/menu');
  expect(window.open).toHaveBeenCalledWith('https://example.ao/menu', '_blank', 'noopener,noreferrer');
});
