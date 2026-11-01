import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecordingControls } from './RecordingControls';
import type { RecordingSession } from '@/features/call-recording/api';
const mocks = vi.hoisted(() => ({ api: vi.fn(), start: vi.fn(), stop: vi.fn(), pause: vi.fn(), update: vi.fn(), upload: vi.fn(), userId: 'me' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock('./ActiveCallProvider', () => ({ useActiveCallRequired: () => ({ webRTCState: {
  callStatus: 'connected', localStream: { id: 'local' }, remoteStreams: new Map([['other', { id: 'remote' }]]),
} }) }));
vi.mock('@/hooks/useCallRecorder', () => ({ useCallRecorder: () => ({ start: mocks.start, stop: mocks.stop, pause: mocks.pause, update: mocks.update }) }));
vi.mock('@/features/call-recording/api', () => ({ recordingSession: mocks.api }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ upload: mocks.upload }) } } }));
let state: RecordingSession | null;
let failure: string | null;
const pending = (): RecordingSession => ({ id: 'rec', initiated_by: 'me', status: 'pending_consent',
  deadline: new Date(Date.now() + 60000).toISOString(), consents: [{ user_id: 'other', consented: false, revoked_at: null }] });
const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const mount = async () => { const view = render(<RecordingControls callId="call" participants={[{ id: 'p', user_id: 'other', display_name: 'Ana' }]} />); await tick(); return view; };
const click = async (name: string) => { fireEvent.click(screen.getByRole('button', { name })); await tick(); };
beforeEach(() => {
  vi.useFakeTimers();vi.clearAllMocks();state=null;failure=null;mocks.userId='me';
  mocks.update.mockReturnValue(true);
  mocks.start.mockReturnValue(true);mocks.stop.mockResolvedValue(new Blob(['recording'], { type: 'video/mp4' }));mocks.upload.mockResolvedValue({error:null});
  mocks.api.mockImplementation(async (_call, action='state', _id, answer) => {
    if (failure === action) throw new Error('network');
    if (action === 'request') state=pending();
    if (action === 'respond' && state) state={...state,status:answer?'pending_consent':'stopped',consents:[{user_id:mocks.userId,consented:answer,revoked_at:answer?null:'now'}]};
    if (state && ['start','cancel','fail','pause','resume','stop','complete'].includes(action)) state={...state,status:({start:'recording',cancel:'stopped',fail:'failed',pause:'paused',resume:'recording',stop:'processing',complete:'completed'} as const)[action as 'start']};
    return state ? structuredClone(state) : null;
  });
});
afterEach(() => { cleanup();vi.useRealTimers(); });

it('waits for every consent, recovers an accepted response by polling, and records only once', async () => {
  await mount();await click('Gravar');
  expect(screen.getByText('Autorização para gravar')).toBeInTheDocument();expect(mocks.start).not.toHaveBeenCalled();
  state={...state!,consents:[{user_id:'other',consented:true,revoked_at:null}]};
  await tick(2000);expect(mocks.start).toHaveBeenCalledOnce();expect(screen.getByText('A gravar')).toBeInTheDocument();
  await tick(4000);expect(mocks.start).toHaveBeenCalledOnce();
});
it('recovers an incoming request on mount without a realtime event', async () => {
  state=pending();mocks.userId='other';await mount();
  expect(screen.getByText('Pedido de gravação')).toBeInTheDocument();await click('Aceitar gravação');
  expect(screen.queryByRole('button',{name:'Aceitar gravação'})).not.toBeInTheDocument();
  expect(mocks.api).toHaveBeenCalledWith('call','respond','rec',true);expect(mocks.start).not.toHaveBeenCalled();
});
it('retains the consent dialog and offers retry after a failed response', async () => {
  state=pending();mocks.userId='other';failure='respond';await mount();await click('Aceitar gravação');
  expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível guardar');
  expect(screen.getByRole('button',{name:'Aceitar gravação'})).toBeEnabled();
  failure=null;await click('Aceitar gravação');expect(state?.consents[0].consented).toBe(true);
});
it('recusal stops the request without starting media', async () => {
  state=pending();mocks.userId='other';await mount();await click('Recusar');
  expect(state?.status).toBe('stopped');expect(mocks.start).not.toHaveBeenCalled();
});
it('closing the initiator dialog cancels and ignores late acceptance', async () => {
  await mount();await click('Gravar');await click('Cancelar pedido');
  expect(state?.status).toBe('stopped');await tick(2000);expect(mocks.start).not.toHaveBeenCalled();
});
it('times out after 60 seconds without starting the recorder', async () => {
  await mount();await click('Gravar');await tick(60001);
  expect(mocks.api).toHaveBeenCalledWith('call','cancel','rec',undefined);expect(mocks.start).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Gravar'})).toBeEnabled();
});
it('shows request failures instead of waiting indefinitely', async () => {
  failure='request';await mount();await click('Gravar');expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText('Autorização para gravar')).not.toBeInTheDocument();expect(mocks.start).not.toHaveBeenCalled();
});
it('does not retry a failed start in an automatic loop', async () => {
  await mount();await click('Gravar');failure='start';state={...state!,consents:[]};await tick(6000);
  expect(mocks.api.mock.calls.filter(c=>c[1]==='start')).toHaveLength(1);expect(mocks.start).not.toHaveBeenCalled();
});
it('pauses, resumes and uploads the actual MP4 before completing', async () => {
  await mount();await click('Gravar');state={...state!,consents:[]};await tick(2000);
  await click('Pausar gravação');expect(mocks.pause).toHaveBeenLastCalledWith(true);
  await click('Retomar gravação');expect(mocks.pause).toHaveBeenLastCalledWith(false);
  await click('Parar e guardar gravação');expect(mocks.upload).toHaveBeenCalledWith('call/rec.mp4',expect.any(Blob),{contentType:'video/mp4',upsert:false});
  expect(screen.getByText('Gravação guardada.')).toBeInTheDocument();
});
it('reports upload failure without claiming the recording was saved', async () => {
  await mount();await click('Gravar');state={...state!,consents:[]};await tick(2000);mocks.upload.mockResolvedValue({error:new Error('storage')});
  await click('Parar e guardar gravação');await tick(2000);
  expect(screen.queryByText('Gravação guardada.')).not.toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível enviar');
  expect(screen.getByRole('button', {name:'Descarregar gravação'})).toBeEnabled();
  mocks.upload.mockResolvedValue({error:null});
  await click('Tentar guardar novamente');
  expect(screen.getByText('Gravação guardada.')).toBeInTheDocument();
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(mocks.upload.mock.calls[0][1]).toBe(mocks.upload.mock.calls[1][1]);
});
it('stops capture if consent state cannot be verified after connection loss', async () => {
  await mount();await click('Gravar');state={...state!,consents:[]};await tick(2000);failure='state';await tick(2000);
  expect(mocks.stop).toHaveBeenCalled();expect(mocks.api).toHaveBeenCalledWith('call','fail','rec');
});
it('does not record on a second device belonging to the initiator', async () => {
  state={...pending(),status:'recording',consents:[]};await mount();await tick(2000);
  expect(screen.getByText('A gravar')).toBeInTheDocument();expect(mocks.start).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'Parar e guardar gravação'})).not.toBeInTheDocument();
});
it('cancels the owned request and releases media when leaving', async () => {
  const view=await mount();await click('Gravar');view.unmount();await tick();
  expect(mocks.api).toHaveBeenCalledWith('call','cancel','rec');expect(mocks.stop).toHaveBeenCalled();
});

it('clears a failed consent check after polling recovers', async () => {
  failure='state';await mount();
  expect(screen.getByRole('alert')).toHaveTextContent('verificar os consentimentos');
  failure=null;await tick(2000);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(mocks.start).not.toHaveBeenCalled();
});
it('does not clear an action error when background polling succeeds', async () => {
  failure='request';await mount();await click('Gravar');await tick(2000);
  expect(screen.getByRole('alert')).toHaveTextContent('concluir o pedido');
});

it('updates media while paused without starting a second recorder or resuming it', async () => {
  await mount();await click('Gravar');state={...state!,consents:[]};await tick(2000);
  await click('Pausar gravação');
  mocks.update.mockClear();await tick(2000);
  expect(mocks.update).toHaveBeenCalled();
  expect(mocks.start).toHaveBeenCalledOnce();
  expect(mocks.pause).toHaveBeenCalledTimes(1);
  expect(mocks.pause).toHaveBeenLastCalledWith(true);
});
it('stops and marks the recording failed when replacement media cannot be attached', async () => {
  await mount();await click('Gravar');state={...state!,consents:[]};await tick(2000);
  mocks.update.mockReturnValue(false);await tick(2000);
  expect(mocks.stop).toHaveBeenCalled();
  expect(mocks.api).toHaveBeenCalledWith('call','fail','rec');
  expect(mocks.upload).not.toHaveBeenCalled();
});
