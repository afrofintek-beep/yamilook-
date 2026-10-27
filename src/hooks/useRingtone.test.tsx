import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRingtone, useRingtonePreview } from './useRingtone';

const { audio } = vi.hoisted(() => ({ audio: {
  state: 'running', currentTime: 0, destination: {}, resume: vi.fn(), createGain: vi.fn(), createOscillator: vi.fn(),
} }));
vi.mock('@/lib/audio-context', () => ({ getSharedAudioContext: () => audio }));
vi.mock('./useSettings', () => ({ useSettings: () => ({ settings: null }) }));
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); audio.state = 'running';
  audio.resume.mockImplementation(async () => { audio.state = 'running'; });
  audio.createGain.mockImplementation(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }));
  audio.createOscillator.mockImplementation(() => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('call ringtone lifecycle', () => {
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
