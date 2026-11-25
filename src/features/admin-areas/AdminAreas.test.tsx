import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminAreaGuard, AdminAreaLinks } from './AdminAreas';
import { adminAreaKeys } from './catalog';
const state = vi.hoisted(() => ({ allowed: {} as Record<string, boolean>, loading: false, error: null as Error | null }));
vi.mock('./useAdminAreas', () => ({ useAdminAreas: () => ({ ...state, any: Object.values(state.allowed).some(Boolean), retry: vi.fn() }) }));
vi.mock('@/features/access-dashboard/AccessDashboardLink', () => ({ AccessDashboardLink: () => null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'operator' } }) }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));
beforeEach(() => { state.allowed = {}; state.loading = false; state.error = null; });
afterEach(cleanup);
it('unmounts the operation UI after revocation and rejects direct unauthorized routes', () => {
  const view = () => <MemoryRouter><AdminAreaGuard area="admin_payouts"><p>Payment actions</p></AdminAreaGuard></MemoryRouter>;
  const result = render(view());
  expect(screen.queryByText('Payment actions')).not.toBeInTheDocument();
  state.allowed.admin_payouts = true; result.rerender(view());
  expect(screen.getByText('Payment actions')).toBeInTheDocument();
  state.allowed.admin_payouts = false; result.rerender(view());
  expect(screen.queryByText('Payment actions')).not.toBeInTheDocument();
});
it('shows only the areas delegated to this operator', () => {
  state.allowed.admin_campaigns = true;
  render(<MemoryRouter><AdminAreaLinks /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Campanhas e convites' })).toHaveAttribute('href','/admin/campanhas');
  expect(screen.queryByRole('link', { name: 'Pagamentos' })).not.toBeInTheDocument();
});
it('includes all eight areas for an authorized administrator', () => {
  state.allowed = Object.fromEntries(adminAreaKeys.map(key => [key,true]));
  render(<MemoryRouter><AdminAreaLinks /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(8);
});
