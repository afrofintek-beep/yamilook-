import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './useAuth';

const controls = vi.hoisted(() => ({
  rpc: vi.fn(),
  signOut: vi.fn(),
  removeChannel: vi.fn(),
  revocationEvent: null as null | (() => void),
  channelNames: [] as string[],
}));

vi.mock('@/lib/private-cache', () => ({ clearLegacyPrivateCache: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/device', () => ({ recordDevice: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/account-sessions', () => ({
  registerCurrentSession: vi.fn().mockResolvedValue(undefined),
  listLoginAlerts: vi.fn().mockResolvedValue([]),
  acknowledgeLoginAlerts: vi.fn().mockResolvedValue(undefined),
  isRevokedSessionError: (error?: { code?: string } | null) =>
    error?.code === '28000' || error?.code === 'PGRST301',
}));
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'account-one' }, access_token: 'token-one' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockImplementation(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: controls.signOut,
    },
    from: vi.fn().mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    })),
    rpc: controls.rpc,
    removeChannel: controls.removeChannel,
    channel: vi.fn().mockImplementation((name: string) => {
      controls.channelNames.push(name);
      const channel = {
        on: vi.fn().mockImplementation((_event, options, handler) => {
          if (options?.table === 'account_session_revocations') {
            controls.revocationEvent = handler;
          }
          return channel;
        }),
        subscribe: vi.fn().mockImplementation((callback?: (status: string) => void) => {
          callback?.('SUBSCRIBED');
          return channel;
        }),
      };
      return channel;
    }),
  },
}));

function AccountStatus() {
  const { user } = useAuth();
  return <p>{user ? 'Conta activa' : 'Conta desligada'}</p>;
}

beforeEach(() => {
  controls.rpc.mockReset();
  controls.rpc.mockResolvedValue({ data: 'session-one', error: null });
  controls.signOut.mockReset();
  controls.signOut.mockResolvedValue({ error: null });
  controls.removeChannel.mockReset();
  controls.removeChannel.mockResolvedValue(undefined);
  controls.revocationEvent = null;
  controls.channelNames = [];
});
afterEach(() => cleanup());

async function mount() {
  render(<AuthProvider><AccountStatus /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('Conta activa')).toBeInTheDocument());
  await waitFor(() => expect(controls.revocationEvent).not.toBeNull());
  await act(async () => { await Promise.resolve(); });
}

describe('realtime session revocation', () => {
  it('subscribes to the current account and verifies a revocation signal before sign out', async () => {
    await mount();
    expect(controls.channelNames).toContain('session-revocations-account-one');

    controls.rpc.mockResolvedValue({ data: 'session-one', error: null });
    await act(async () => controls.revocationEvent?.());
    expect(screen.getByText('Conta activa')).toBeInTheDocument();
    expect(controls.signOut).not.toHaveBeenCalled();
  });

  it('immediately hides the protected account and signs out only on server-confirmed revocation', async () => {
    await mount();
    controls.rpc.mockResolvedValue({ data: null, error: { code: '28000', status: 403 } });
    await act(async () => controls.revocationEvent?.());
    await waitFor(() => expect(screen.getByText('Conta desligada')).toBeInTheDocument());
    await waitFor(() => expect(controls.signOut).toHaveBeenCalledWith({ scope: 'local' }));
  });

  it('does not end a legitimate session for connectivity errors', async () => {
    await mount();
    controls.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', status: 404 } });
    await act(async () => controls.revocationEvent?.());
    expect(screen.getByText('Conta activa')).toBeInTheDocument();
    expect(controls.signOut).not.toHaveBeenCalled();
  });
});
