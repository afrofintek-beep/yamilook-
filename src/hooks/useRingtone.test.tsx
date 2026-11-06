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
  audio.createOscillator.mockImplementation(() => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }));
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
  it('plays the selected tone and stops all resources on answer/decline', async () => {
    const { result } = renderHook(() => useRingtone({ pattern: 'modern', vibrationEnabled: false }));
    await act(async () => result.current.startRingtone());
    expect(audio.createOscillator.mock.results.map(r => r.value.frequency.value)).toEqual([523, 659]);
    act(() => result.current.stopRingtone());
    for (const oscillator of audio.createOscillator.mock.results) expect(oscillator.value.stop).toHaveBeenCalled();
    expect(audio.createGain.mock.results[0].value.disconnect).toHaveBeenCalled();
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
