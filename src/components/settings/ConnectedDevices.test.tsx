import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConnectedDevices } from './ConnectedDevices';

const { auth, toast, listAccountSessions, listLoginAlerts, revokeAccountSession } = vi.hoisted(() => ({
  auth: { user: { id: 'account-a' } as { id: string } | null },
  toast: vi.fn(),
  listAccountSessions: vi.fn(),
  listLoginAlerts: vi.fn(),
  revokeAccountSession: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/account-sessions', () => ({ listAccountSessions, listLoginAlerts, revokeAccountSession }));

const current = {
  id: '11111111-1111-4111-8111-111111111111',
  device_label: 'iOS · Safari', platform: 'iOS', browser: 'Safari',
  app_surface: 'kosolola', first_seen: '2026-10-27T12:00:00Z',
  last_seen: '2026-10-27T12:00:00Z', is_current: true,
};
const other = { ...current, id: '22222222-2222-4222-8222-222222222222', device_label: 'Windows · Chrome', app_surface: 'yamilook', is_current: false };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'account-a' };
  listAccountSessions.mockResolvedValue([current, other]);
  listLoginAlerts.mockResolvedValue([{ id: 'a', device_label: 'Windows · Chrome', app_surface: 'yamilook', occurred_at: '2026-10-27T12:00:00Z', unread: true }]);
  revokeAccountSession.mockResolvedValue(undefined);
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('multi-device settings for both app surfaces', () => {
  it('lists both authenticated sessions and protects the current one', async () => {
    render(<ConnectedDevices />);
    expect(await screen.findByText(/iOS · Safari/)).toBeInTheDocument();
    expect(screen.getAllByText(/Windows · Chrome/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Este dispositivo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revogar iOS · Safari' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revogar Windows · Chrome' })).toBeInTheDocument();
    expect(screen.getByText('Histórico de novos acessos')).toBeInTheDocument();
  });

  it('revokes only the selected other session after confirmation', async () => {
    render(<ConnectedDevices />);
    await screen.findByRole('button', { name: 'Revogar Windows · Chrome' });
    fireEvent.click(screen.getByRole('button', { name: 'Revogar Windows · Chrome' }));
    await waitFor(() => expect(revokeAccountSession).toHaveBeenCalledExactlyOnceWith(other.id));
    expect(revokeAccountSession).not.toHaveBeenCalledWith(current.id);
  });

  it('does not revoke when the user cancels confirmation', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<ConnectedDevices />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar Windows · Chrome' }));
    expect(revokeAccountSession).not.toHaveBeenCalled();
  });

  it('does not pretend success if the server denies revocation', async () => {
    revokeAccountSession.mockRejectedValue(new Error('Unauthorized'));
    render(<ConnectedDevices />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar Windows · Chrome' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Acesso revogado' }));
  });

  it('shows an error instead of fabricated devices when offline', async () => {
    listAccountSessions.mockRejectedValue(new Error('offline'));
    render(<ConnectedDevices />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar as sessões');
  });
});
