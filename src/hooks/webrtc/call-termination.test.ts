import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishCallLocallyFirst, watchCallTermination } from './call-termination';

describe('call termination', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('releases devices synchronously even when both network requests hang', () => {
    const release = vi.fn();
    void finishCallLocallyFirst(release, () => new Promise(() => {}), () => new Promise(() => {}));
    expect(release).toHaveBeenCalledOnce();
  });

  it('attempts both notification and persistence despite failure', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const results = await finishCallLocallyFirst(vi.fn(), async () => { throw Error('offline'); }, persist);
    expect(persist).toHaveBeenCalledOnce();
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled']);
  });

  it('reconciles a missed terminal signal by polling and ends only once', async () => {
    vi.useFakeTimers();
    const read = vi.fn().mockResolvedValueOnce('ongoing').mockResolvedValue('ended');
    const onEnded = vi.fn();
    let receive!: (status: string) => void;
    const unsubscribe = vi.fn();
    const stop = watchCallTermination({ read, subscribe: listener => { receive = listener; return unsubscribe; }, onEnded });
    await vi.advanceTimersByTimeAsync(2000);
    receive('ended');
    await vi.advanceTimersByTimeAsync(4000);
    expect(onEnded).toHaveBeenCalledOnce();
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('ends immediately on realtime termination', () => {
    const onEnded = vi.fn();
    let receive!: (status: string) => void;
    const stop = watchCallTermination({ read: async () => 'ongoing', subscribe: listener => { receive = listener; return vi.fn(); }, onEnded });
    receive('ended');
    expect(onEnded).toHaveBeenCalledOnce();
    stop();
  });

  it('does not end on network failure and reconciles when online again', async () => {
    const read = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue('declined');
    const onEnded = vi.fn();
    const stop = watchCallTermination({ read, subscribe: () => vi.fn(), onEnded });
    await Promise.resolve();
    expect(onEnded).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(onEnded).toHaveBeenCalledOnce();
    stop();
  });

  it('ignores a late response after disposing an old call', async () => {
    let resolve!: (status: string) => void;
    const onEnded = vi.fn();
    const stop = watchCallTermination({ read: () => new Promise(r => { resolve = r; }), subscribe: () => vi.fn(), onEnded });
    stop();
    resolve('ended');
    await Promise.resolve();
    expect(onEnded).not.toHaveBeenCalled();
  });
});
