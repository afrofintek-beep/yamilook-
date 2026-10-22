import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Install from './Install';
import { captureAppInstallPrompt, clearAppInstallPrompt, type InstallPrompt } from '@/lib/app-install';
beforeEach(() => {
  clearAppInstallPrompt(); captureAppInstallPrompt();
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() } as unknown as MediaQueryList);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const show = () => render(<MemoryRouter><Install /></MemoryRouter>);
it('retains an install request raised before the install screen opens', async () => {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallPrompt;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Instalar agora' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Instalação cancelada'));
  expect(screen.queryByText('Yamilook instalado!')).not.toBeInTheDocument();
});
it('does not claim installation solely because a prompt was accepted', async () => {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallPrompt;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event); show();
  fireEvent.click(screen.getByRole('button', { name: 'Instalar agora' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Pedido aceite'));
  expect(screen.queryByText('Yamilook instalado!')).not.toBeInTheDocument();
});
it('shows the iPhone manual installation steps', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone');
  show();
  expect(screen.getByText('Abrir como aplicação web')).toBeInTheDocument();
  expect(screen.getByText('ícone Yamilook')).toBeInTheDocument();
});
it('recognizes an installed standalone app', async () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() } as unknown as MediaQueryList);
  show();
  expect(await screen.findByText('Modo aplicação activo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Continuar no Yamilook' })).toHaveAttribute('href', '/muxi');
});
