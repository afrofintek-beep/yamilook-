import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ActiveCallProvider, useActiveCallRequired } from './ActiveCallProvider';
const mocks = vi.hoisted(() => ({
  start: vi.fn(), end: vi.fn(), tone: vi.fn(), answerCall: vi.fn(), toast: vi.fn(), setIncomingCall: vi.fn(),
  incomingCall: { id: 'call', type: 'voice', initiator_id: 'caller' },
}));
vi.mock('@/lib/call-feedback', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/call-feedback')>()), playCallTone: mocks.tone, stopCallTone: vi.fn() }));
vi.mock('@/lib/audio-context', () => ({ unlockCallAudio: vi.fn() }));
vi.mock('@/hooks/useCalls', () => ({ useCalls: () => ({ incomingCall: mocks.incomingCall, setIncomingCall: mocks.setIncomingCall }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/features/scheduled-calls/ScheduledCallNotices', () => ({ ScheduledCallNotices: () => null }));
vi.mock('./IncomingCallOverlay', () => ({ IncomingCallOverlay: ({ onAnswer }: { onAnswer: () => void }) => <button onClick={onAnswer}>Atender teste</button> }));
vi.mock('@/hooks/useCallTransport', () => ({ useCallTransport: () => ({
  state: { callStatus: 'connecting' }, initiateCall: mocks.start, endCall: mocks.end, answerCall: mocks.answerCall, markUserInteracted: vi.fn(),
}) }));
function Consumer() {
  const { joinCall, startCall } = useActiveCallRequired();
  return <><button onClick={() => void joinCall('call', 'voice', 'caller')}>Entrar teste</button><button onClick={() => void startCall('other', 'voice')}>Ligar teste</button></>;
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

it('shows busy feedback without treating it as a media failure', async () => {
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  mocks.start.mockRejectedValue({ message: 'callee_busy' });
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  await act(async () => fireEvent.click(screen.getByText('Ligar teste')));
  expect(mocks.tone).toHaveBeenCalledWith('busy');
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({title:'Ocupado'}));
  expect(screen.queryByRole('dialog', {name:'A iniciar chamada'})).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});
it('can cancel setup and ignores its late successful result', async () => {
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  let finish!: (id: string) => void;
  mocks.start.mockImplementation(() => new Promise<string>(resolve => {finish=resolve;}));
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  fireEvent.click(screen.getByText('Ligar teste'));fireEvent.click(screen.getByText('Ligar teste'));
  expect(mocks.start).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText('Cancelar chamada'));expect(mocks.end).toHaveBeenCalledOnce();
  await act(async () => finish('late-call'));
  expect(screen.queryByRole('dialog', {name:'A iniciar chamada'})).not.toBeInTheDocument();
  expect(mocks.toast).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
