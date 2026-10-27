import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ActiveCallProvider, useActiveCallRequired } from './ActiveCallProvider';
const mocks = vi.hoisted(() => ({
  answerCall: vi.fn(), toast: vi.fn(), setIncomingCall: vi.fn(),
  incomingCall: { id: 'call', type: 'voice', initiator_id: 'caller' },
}));
vi.mock('@/hooks/useCalls', () => ({ useCalls: () => ({ incomingCall: mocks.incomingCall, setIncomingCall: mocks.setIncomingCall }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/features/scheduled-calls/ScheduledCallNotices', () => ({ ScheduledCallNotices: () => null }));
vi.mock('./IncomingCallOverlay', () => ({ IncomingCallOverlay: ({ onAnswer }: { onAnswer: () => void }) => <button onClick={onAnswer}>Atender teste</button> }));
vi.mock('@/hooks/useWebRTC', () => ({ useWebRTC: () => ({
  state: { callStatus: 'connecting' }, answerCall: mocks.answerCall, markUserInteracted: vi.fn(),
}) }));
function Consumer() {
  const { joinCall } = useActiveCallRequired();
  return <button onClick={() => void joinCall('call', 'voice', 'caller')}>Entrar teste</button>;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('answers once when repeated taps and a room join overlap', async () => {
  let finish!: () => void;
  mocks.answerCall.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  const answer = await screen.findByText('Atender teste');
  fireEvent.click(answer); fireEvent.click(answer); fireEvent.click(screen.getByText('Entrar teste'));
  expect(mocks.answerCall).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(mocks.setIncomingCall).toHaveBeenCalledWith(null);
});
it('reports answering failures and lets the user retry', async () => {
  mocks.answerCall.mockRejectedValue(new Error('microphone unavailable'));
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  const answer = await screen.findByText('Atender teste');
  await act(async () => fireEvent.click(answer));
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'microphone unavailable' }));
  expect(mocks.setIncomingCall).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(answer));
  expect(mocks.answerCall).toHaveBeenCalledTimes(2);
});
