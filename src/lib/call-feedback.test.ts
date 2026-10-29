import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { callErrorCode, callOutcomeMessage, playCallTone, stopCallTone } from './call-feedback';
const m = vi.hoisted(() => ({ nodes: [] as any[], state: 'running', resume: vi.fn(), gain: vi.fn() }));
vi.mock('./audio-context', () => ({ getSharedAudioContext: () => ({
  get state() { return m.state; }, currentTime: 0, destination: {}, resume: m.resume,
  createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }),
  createOscillator: () => { const node = { frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; m.nodes.push(node); return node; },
}) }));
beforeEach(() => { vi.useFakeTimers(); m.nodes.length = 0; m.state = 'running'; });
afterEach(() => { stopCallTone(); vi.useRealTimers(); vi.clearAllMocks(); });
it('plays three busy pulses and stops automatically', () => {
  playCallTone('busy'); vi.advanceTimersByTime(3000);
  expect(m.nodes).toHaveLength(3);
  vi.advanceTimersByTime(10000); expect(m.nodes).toHaveLength(3);
});
it('stops ringback on answer/cancellation and replaces it with feedback', () => {
  const stop=playCallTone('ringback');vi.advanceTimersByTime(4000);expect(m.nodes).toHaveLength(2);
  stop();vi.advanceTimersByTime(8000);expect(m.nodes).toHaveLength(2);
  playCallTone('ended');vi.advanceTimersByTime(4000);expect(m.nodes).toHaveLength(3);
});
it('does not restart a cancelled tone when audio resumes late', async () => {
  m.state='suspended';let resolve!:()=>void;m.resume.mockReturnValue(new Promise<void>(r=>{resolve=r;}));
  const stop=playCallTone('ringback');stop();m.state='running';resolve();await Promise.resolve();
  expect(m.nodes).toHaveLength(0);
});
it('keeps busy, unavailable and terminal outcomes distinct', () => {
  expect(callErrorCode({message:'callee_busy'})).toBe('callee_busy');
  expect(callErrorCode(Error('network'))).toBeNull();
  expect(callOutcomeMessage('ended','no_answer')).toBe('Sem resposta.');
  expect(callOutcomeMessage('declined')).toBe('Chamada recusada.');
  expect(callOutcomeMessage('ended','cancelled')).toBe('Chamada cancelada.');
});
