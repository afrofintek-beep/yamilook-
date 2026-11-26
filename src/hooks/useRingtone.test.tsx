import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRingtone, useRingtonePreview } from './useRingtone';

const { audio, prefs } = vi.hoisted(() => ({ prefs: { ringtone_pattern: 'default', ringtone_enabled: true, ringtone_volume: 0.5 }, audio: {
  state: 'running', currentTime: 0, destination: {}, resume: vi.fn(), createGain: vi.fn(), createOscillator: vi.fn(),
} }));
vi.mock('@/lib/audio-context', () => ({ getSharedAudioContext: () => audio }));
vi.mock('./useSettings', () => ({ useSettings: () => ({ settings: prefs }) }));
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); audio.state = 'running';
  prefs.ringtone_pattern='default';prefs.ringtone_enabled=true;prefs.ringtone_volume=0.5;
  audio.resume.mockImplementation(async () => { audio.state = 'running'; });
  audio.createGain.mockImplementation(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }));
  audio.createOscillator.mockImplementation(() => ({
    type: '',
    frequency: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('call ringtone lifecycle', () => {
  it('uses a short quiet waiting pulse without continuous ringing', async () => {
    const {result}=renderHook(()=>useRingtone({waiting:true}));
    await act(async()=>result.current.startRingtone());
    expect(audio.createOscillator).toHaveBeenCalledOnce();
    expect(audio.createGain.mock.results[0].value.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.12,0.1);
    await act(async()=>vi.advanceTimersByTime(8000));expect(audio.createOscillator).toHaveBeenCalledOnce();
    await act(async()=>vi.advanceTimersByTime(300));expect(audio.createOscillator).toHaveBeenCalledTimes(2);
  });
  it('respects silence and disabled ringing while a call is waiting',async()=>{
    prefs.ringtone_pattern='silent';
    const first=renderHook(()=>useRingtone({waiting:true}));
    await act(async()=>first.result.current.startRingtone());first.unmount();
    prefs.ringtone_pattern='default';prefs.ringtone_enabled=false;
    const second=renderHook(()=>useRingtone({waiting:true}));
    await act(async()=>second.result.current.startRingtone());
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });
  it.each([
    { pattern: 'modern', notes: [[523.25, 0], [659.25, 0.19], [783.99, 0.372], [1046.50, 0.59], [783.99, 0.9]], end: 1.27, cycle: 2700 },
    { pattern: 'gentle', notes: [[440, 0], [659.25, 0.5], [554.37, 0.995]], end: 1.58, cycle: 3700 },
    { pattern: 'urgent', notes: [[587.33, 0], [880, 0.135], [739.99, 0.29], [987.77, 0.555], [880, 0.725]], end: 1.04, cycle: 2100 },
  ])('plays the saved $pattern melody and cancels scheduled notes when the call ends', async ({ pattern, notes, end, cycle }) => {
    prefs.ringtone_pattern = pattern;
    const { result } = renderHook(() => useRingtone({ vibrationEnabled: false }));
    await act(async () => result.current.startRingtone());
    expect(audio.createOscillator).toHaveBeenCalledOnce();
    const firstOscillator = audio.createOscillator.mock.results[0].value;
    expect(firstOscillator.frequency.setValueAtTime.mock.calls).toEqual(notes);
    expect(firstOscillator.stop).toHaveBeenCalledWith(end);
    await act(async () => vi.advanceTimersByTime(cycle - 1));
    expect(firstOscillator.disconnect).toHaveBeenCalledOnce();
    expect(audio.createOscillator).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(1));
    const secondOscillator = audio.createOscillator.mock.results[1].value;
    act(() => result.current.stopRingtone());
    expect(secondOscillator.stop).toHaveBeenLastCalledWith();
    expect(secondOscillator.disconnect).toHaveBeenCalledOnce();
    expect(audio.createGain.mock.results[1].value.disconnect).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(10000));
    expect(audio.createOscillator).toHaveBeenCalledTimes(2);
  });
  it('resumes an interrupted iPhone audio context', async () => {
    audio.state = 'interrupted';
    const { result } = renderHook(() => useRingtone({ vibrationEnabled: false }));
    await act(async () => result.current.startRingtone());
    expect(audio.resume).toHaveBeenCalledOnce();
    expect(audio.createOscillator).toHaveBeenCalledTimes(2);
  });
  it('does not ring after a call ends while audio unlock is pending', async () => {
    audio.state = 'suspended';
    let unlock!: () => void;
    audio.resume.mockImplementation(() => new Promise<void>(resolve => { unlock = () => { audio.state = 'running'; resolve(); }; }));
    const { result } = renderHook(() => useRingtone({ vibrationEnabled: false }));
    act(() => result.current.startRingtone());
    await act(async () => vi.advanceTimersByTime(6000));
    expect(audio.resume).toHaveBeenCalledOnce();
    act(() => result.current.stopRingtone());
    await act(async () => unlock());
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });
  it('honours disabled and silent tones', async () => {
    const first = renderHook(() => useRingtone({ ringtoneEnabled: false, vibrationEnabled: false }));
    act(() => first.result.current.startRingtone()); first.unmount();
    const second = renderHook(() => useRingtone({ pattern: 'silent', vibrationEnabled: false }));
    await act(async () => second.result.current.startRingtone());
    expect(audio.createOscillator).not.toHaveBeenCalled();
  });
  it('restarting a preview cancels the previous stop timer', async () => {
    const { result, unmount } = renderHook(() => useRingtonePreview({ vibrationEnabled: false }));
    await act(async () => result.current.playPreview(3000));
    await act(async () => vi.advanceTimersByTime(2000));
    await act(async () => result.current.playPreview(3000));
    const gain = audio.createGain.mock.results.at(-1)!.value;
    await act(async () => vi.advanceTimersByTime(500));
    expect(gain.disconnect).not.toHaveBeenCalled();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
