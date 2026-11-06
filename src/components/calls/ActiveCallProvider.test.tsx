vi.mock('@/features/group-calls/GroupConferenceProvider', () => ({ GroupConferenceProvider: ({children}: {children: React.ReactNode}) => <>{children}</> }));
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ActiveCallProvider, useActiveCallRequired } from './ActiveCallProvider';
import { unlockCallAudio } from '@/lib/audio-context';
const mocks = vi.hoisted(() => ({
  state: { callStatus: 'connecting' } as any, start: vi.fn(), end: vi.fn(), replace: vi.fn(), decline: vi.fn(), tone: vi.fn(), answerCall: vi.fn(), toast: vi.fn(), setIncomingCall: vi.fn(),
  incomingCall: { id: 'call', type: 'voice', initiator_id: 'caller' },
}));
vi.mock('@/lib/call-feedback', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/call-feedback')>()), playCallTone: mocks.tone, stopCallTone: vi.fn() }));
vi.mock('@/lib/audio-context', () => ({ unlockCallAudio: vi.fn() }));
vi.mock('@/hooks/useCalls', () => ({ useCalls: () => ({ incomingCall: mocks.incomingCall, setIncomingCall: mocks.setIncomingCall }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/features/scheduled-calls/ScheduledCallNotices', () => ({ ScheduledCallNotices: () => null }));
vi.mock('./IncomingCallOverlay', () => ({ IncomingCallOverlay: ({ onAnswer, onDecline, waiting }: { onAnswer: () => void; onDecline:()=>void; waiting?:boolean }) => <><button onClick={onAnswer}>{waiting ? 'Terminar atual e atender' : 'Atender teste'}</button><button onClick={onDecline}>Recusar teste</button></> }));
vi.mock('@/hooks/useCallTransport', () => ({ useCallTransport: () => ({
  state: mocks.state, initiateCall: mocks.start, endCall: mocks.end, answerCall: mocks.answerCall, endAndAnswerCall:mocks.replace, declineCall:mocks.decline, markUserInteracted: vi.fn(),
}) }));
function Consumer() {
  const { joinCall, startCall, currentCallId } = useActiveCallRequired();
  return <><output>{currentCallId}</output><button onClick={() => void joinCall('call', 'voice', 'caller')}>Entrar teste</button><button onClick={() => void startCall('other', 'voice')}>Ligar teste</button></>;
}
afterEach(() => { cleanup(); mocks.state = { callStatus: 'connecting' }; vi.clearAllMocks(); vi.unstubAllGlobals(); });
it('starts joining immediately even if the browser audio context cannot resume yet', async () => {
  vi.stubGlobal('AudioContext', class { resume = () => new Promise(() => {}); close = vi.fn(); });
  mocks.answerCall.mockResolvedValue(undefined);
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  await act(async () => fireEvent.click(screen.getByText('Entrar teste')));
  expect(unlockCallAudio).toHaveBeenCalledOnce();
  expect(mocks.answerCall).toHaveBeenCalledWith('call', 'voice', 'caller');
  expect(screen.queryByRole('dialog', { name: 'A iniciar chamada' })).not.toBeInTheDocument();
});
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

it('plays rejection feedback once when the recipient declines', async () => {
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  mocks.start.mockResolvedValue('rejected-call');
  const view = () => <MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>;
  const { rerender } = render(view());
  await act(async () => fireEvent.click(screen.getByText('Ligar teste')));
  mocks.state = { callStatus: 'declined', callId: null, lastError: 'Chamada recusada.' };
  rerender(view());
  expect(mocks.tone).toHaveBeenCalledWith('declined');
  expect(mocks.toast).toHaveBeenCalledWith({ title: 'Chamada recusada.' });
  rerender(view());
  expect(mocks.tone.mock.calls.filter(([tone]) => tone === 'declined')).toHaveLength(1);
  vi.unstubAllGlobals();
});

it('shows preparation while answering and ignores completion after cancellation', async () => {
  let finish!: () => void;
  mocks.answerCall.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  fireEvent.click(await screen.findByText('Atender teste'));
  expect(screen.getByRole('dialog', { name: 'A iniciar chamada' })).toHaveTextContent('microfone');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar chamada' }));
  await act(async () => finish());
  expect(mocks.end).toHaveBeenCalledOnce();
  expect(mocks.setIncomingCall).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: 'A iniciar chamada' })).not.toBeInTheDocument();
});

it('uses the incoming voice type while the previous transport still says video', async () => {
  mocks.state = { callStatus: 'ended', callType: 'video' };
  let finish!: () => void;
  mocks.answerCall.mockImplementation(() => new Promise<void>(resolve => {finish=resolve;}));
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  fireEvent.click(await screen.findByText('Atender teste'));
  const dialog=screen.getByRole('dialog', { name: 'A iniciar chamada' });
  expect(dialog).toHaveTextContent('Chamada de voz');
  expect(dialog).not.toHaveTextContent('Videochamada');
  await act(async () => finish());
});
async function ongoing() {
  vi.stubGlobal('isSecureContext',true);
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn()}});
  mocks.state={callStatus:'connected',callId:'active'};mocks.start.mockResolvedValue('active');
  render(<MemoryRouter><ActiveCallProvider><Consumer /></ActiveCallProvider></MemoryRouter>);
  await act(async()=>fireEvent.click(screen.getByText('Ligar teste')));
  await screen.findByText('Terminar atual e atender');
}
it('shows a waiting action without ending the current call, and refusal only targets the waiting caller',async()=>{
  await ongoing();
  expect(mocks.end).not.toHaveBeenCalled();expect(mocks.answerCall).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(screen.getByText('Recusar teste')));
  expect(mocks.decline).toHaveBeenCalledWith('call','caller');expect(screen.getByRole('status')).toHaveTextContent('active');
  expect(mocks.end).not.toHaveBeenCalled();
});
it('requires explicit end-and-answer and deduplicates taps',async()=>{
  await ongoing();let finish!:()=>void;mocks.replace.mockImplementation(()=>new Promise<void>(r=>{finish=r;}));
  fireEvent.click(screen.getByText('Terminar atual e atender'));fireEvent.click(screen.getByText('Terminar atual e atender'));
  expect(mocks.replace).toHaveBeenCalledOnce();expect(mocks.replace).toHaveBeenCalledWith('active','call','voice','caller');
  await act(async()=>finish());expect(screen.getByRole('status')).toHaveTextContent('call');
});
it('prevents a deep link from answering over an ongoing call',async()=>{
  await ongoing();await act(async()=>fireEvent.click(screen.getByText('Entrar teste')));
  expect(mocks.answerCall).not.toHaveBeenCalled();expect(mocks.replace).not.toHaveBeenCalled();
});
