import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Calls from './Calls';
import { CallsTabContent } from '@/components/calls/CallsTabContent';
const mocks = vi.hoisted(() => ({ stats: vi.fn().mockResolvedValue(null), schedule: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/components/calls/ActiveCallProvider', () => ({ useActiveCall: () => null }));
vi.mock('@/hooks/useOnlineStatus', () => ({ useMultipleUserStatus: () => ({ statuses: {} }) }));
vi.mock('@/components/calls/ScheduledCallCard', () => ({ ScheduledCallCard: () => null }));
vi.mock('@/components/calls/VoicemailRecorder', () => ({ VoicemailRecorder: () => null }));
vi.mock('@/components/calls/ScheduleCallSheet', () => ({ ScheduleCallSheet: () => { mocks.schedule(); return null; } }));
vi.mock('@/hooks/useCalls', () => ({ useCalls: () => ({
  callHistory: [
    { id: 'invalid', started_at: 'invalid-date', ended_at: null, status: 'ended', type: 'voice', participants: [{ user_id: 'peer', display_name: 'Contacto teste', avatar_url: null }] },
    { id: 'missing', started_at: null, ended_at: null, status: 'missed', type: 'voice', participants: [] },
  ], scheduledCalls: [], loading: false, getCallStatistics: mocks.stats,
}) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each([['page', Calls], ['tab', CallsTabContent]] as const)('%s renders incomplete history without crashing or mounting the closed scheduler', async (_, Component) => {
  render(<MemoryRouter><Component /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Contacto teste')).toBeVisible());
  expect(screen.getByText('Data indisponível')).toBeVisible();
  expect(mocks.schedule).not.toHaveBeenCalled();
});
