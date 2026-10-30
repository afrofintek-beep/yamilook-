import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PaposBoundary } from './PaposBoundary';
import { recoverApplicationAssets } from '@/lib/app-assets';
vi.mock('@/lib/app-assets', () => ({ recoverApplicationAssets: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });
it('does not mislabel a render error as a network problem and can retry', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let broken = true;
  function Page() { if (broken) throw new Error('render failed'); return <p>Conversa recuperada</p>; }
  render(<PaposBoundary><Page /></PaposBoundary>);
  expect(screen.getByText(/A interface encontrou um erro/)).toBeVisible();
  expect(recoverApplicationAssets).not.toHaveBeenCalled();
  broken = false; fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(screen.getByText('Conversa recuperada')).toBeVisible();
});
it('bounds automatic chunk recovery to avoid repeated reload loops', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sessionStorage.setItem('papos-chunk-recovery-at', String(Date.now()));
  function Page(): never { throw new Error('Failed to fetch dynamically imported module'); }
  render(<PaposBoundary><Page /></PaposBoundary>);
  expect(screen.getByText(/ficheiros da aplicação/)).toBeVisible();
  expect(recoverApplicationAssets).not.toHaveBeenCalled();
});

it.each([false, true])('shows the current diagnostic on the first failure, storage blocked=%s', (blocked) => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sessionStorage.setItem('kosolola-render-diagnostic-v1', JSON.stringify({ category: 'stale-error' }));
  if (blocked) vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  function Broken(): never { throw new Error('Rendered fewer hooks than expected'); }
  const { container } = render(<PaposBoundary><Broken /></PaposBoundary>);
  expect(container.querySelector('pre')).toHaveTextContent('hook-order');
  expect(container.querySelector('pre')).not.toHaveTextContent('stale-error');
});
