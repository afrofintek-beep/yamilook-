import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ActiveCallProvider, useActiveCallRequired } from './ActiveCallProvider';
const m = vi.hoisted(() => ({ initiateCall: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: '00000000-0000-4000-8000-000000000001' } }) }));
vi.mock('@/hooks/useWebRTC', () => ({ useWebRTC: () => ({ state: { callStatus: 'idle' }, initiateCall: m.initiateCall }) }));
vi.mock('@/hooks/useCalls', () => ({ useCalls: () => ({ incomingCall: null }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('@/features/scheduled-calls/ScheduledCallNotices', () => ({ ScheduledCallNotices: () => null }));
it.each(['voice', 'video'] as const)('shows self-call message before even checking media capability: %s', async type => {
  vi.clearAllMocks();
  const { result } = renderHook(() => useActiveCallRequired(), { wrapper: ({ children }) => <MemoryRouter><ActiveCallProvider>{children}</ActiveCallProvider></MemoryRouter> });
  await act(async () => result.current.startCall('00000000-0000-4000-8000-000000000001', type));
  expect(m.initiateCall).not.toHaveBeenCalled();
  expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('própria conta') }));
  expect(result.current.isInCall).toBe(false);
});
