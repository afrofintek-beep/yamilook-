import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppSurfaceContext } from '@/lib/app-surface';
const state = vi.hoisted(() => ({ wallet: false, admin: false, loading: false, error: null as unknown, retry: vi.fn() }));
vi.mock('@/features/integration-access/useIntegrationAccess', () => ({ useIntegrationAccess: () => state }));
import { WalletAccessGate, WalletAccessManager, useWalletAccess } from './WalletAccess';
beforeEach(() => { Object.assign(state, { wallet: false, admin: false, loading: false, error: null }); state.retry.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
function renderGate(silent = false) {
  return render(<MemoryRouter><WalletAccessGate silent={silent}><p>Saldo privado</p></WalletAccessGate></MemoryRouter>);
}
it('blocks a direct link when the central policy denies access', () => {
  renderGate();
  expect(screen.getByText('Esta conta não tem acesso a esta funcionalidade.')).toBeInTheDocument();
  expect(screen.queryByText('Saldo privado')).not.toBeInTheDocument();
});
it('opens the wallet only with a confirmed central permission', () => {
  state.wallet = true; const view = renderGate();
  expect(screen.getByText('Saldo privado')).toBeVisible();
  state.wallet = false; view.rerender(<MemoryRouter><WalletAccessGate><p>Saldo privado</p></WalletAccessGate></MemoryRouter>);
  expect(screen.queryByText('Saldo privado')).toBeNull();
});
it('fails closed while loading or on error even if a stale allowed value remains', () => {
  Object.assign(state, { wallet: true, admin: true, loading: true });
  const { result, rerender } = renderHook(useWalletAccess);
  expect(result.current.allowed).toBe(false); expect(result.current.admin).toBe(false);
  state.loading = false; state.error = new Error('offline'); rerender();
  expect(result.current.allowed).toBe(false); expect(result.current.admin).toBe(false);
  renderGate(); expect(screen.getByText('Não foi possível verificar o acesso.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })); expect(state.retry).toHaveBeenCalledOnce();
});
it('keeps a denied menu item silent', () => {
  const view = renderGate(true); expect(view.container).toBeEmptyDOMElement();
});
it.each(['yamilook','papos'] as const)('links %s administrators to the single access dashboard', surface => {
  state.admin = true;
  render(<AppSurfaceContext.Provider value={surface}><MemoryRouter><WalletAccessManager /></MemoryRouter></AppSurfaceContext.Provider>);
  expect(screen.getByRole('link', { name: 'Abrir dashboard de acessos' })).toHaveAttribute('href', surface === 'papos' ? 'https://www.yamilook.com/admin/acessos' : '/admin/acessos');
  expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.queryByRole('button', { name: 'Conceder acesso' })).toBeNull();
});
it('does not expose the management link to an ordinary allowed account', () => {
  state.wallet = true; const view = render(<MemoryRouter><WalletAccessManager /></MemoryRouter>);
  expect(view.container).toBeEmptyDOMElement();
});
it('keeps the blocked KOSOLOLA user inside KOSOLOLA', () => {
  render(<AppSurfaceContext.Provider value="papos"><MemoryRouter><WalletAccessGate><p>Saldo privado</p></WalletAccessGate></MemoryRouter></AppSurfaceContext.Provider>);
  expect(screen.getByRole('link', { name: 'Voltar à KOSOLOLA' })).toHaveAttribute('href', '/papos');
});
