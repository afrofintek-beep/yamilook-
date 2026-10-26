import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicProfileById, fetchPublicProfilesBatched } from './public-profile-batch';

const state = vi.hoisted(() => ({
  requested: [] as string[][],
  failure: false,
  hold: false,
  release: null as (() => void) | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table !== 'public_profiles') throw new Error('Unexpected table');
      return {
        select: vi.fn(() => ({
          in: vi.fn(async (_column: string, ids: string[]) => {
            state.requested.push(ids);
            if (state.hold) await new Promise<void>(resolve => { state.release = resolve; });
            return state.failure
              ? { data: null, error: new Error('Public profile query failed') }
              : { data: ids.map(id => ({
                id, display_name: 'Member ' + id, username: 'member', avatar_url: null,
                bio: null, is_online: false, last_seen: null, status_message: null,
                show_online_status: true, show_last_seen: true,
              })), error: null };
          }),
        })),
      };
    }),
  },
}));

beforeEach(() => {
  state.requested.length = 0;
  state.failure = false;
  state.hold = false;
  state.release = null;
});

describe('public profile request batching', () => {
  it('coalesces overlapping ID lists and returns only each caller\'s profiles', async () => {
    const first = fetchPublicProfilesBatched(['a', 'b', 'a']);
    const second = fetchPublicProfilesBatched(['b', 'c']);
    const single = fetchPublicProfileById('b');

    const [left, right, one] = await Promise.all([first, second, single]);
    expect(state.requested).toEqual([['a', 'b', 'c']]);
    expect(left.data?.map(p => p.id)).toEqual(['a', 'b']);
    expect(right.data?.map(p => p.id)).toEqual(['b', 'c']);
    expect(one.data?.id).toBe('b');
  });

  it('joins reads that arrive while an earlier request is in flight', async () => {
    state.hold = true;
    const first = fetchPublicProfilesBatched(['same-user']);
    await Promise.resolve();
    const second = fetchPublicProfileById('same-user');
    expect(state.requested).toEqual([['same-user']]);
    state.release?.();
    const [left, right] = await Promise.all([first, second]);
    expect(left.data?.[0]?.id).toBe('same-user');
    expect(right.data?.id).toBe('same-user');
    expect(state.requested).toHaveLength(1);
  });

  it('skips network reads for an empty list', async () => {
    expect(await fetchPublicProfilesBatched([])).toEqual({ data: [], error: null });
    expect(state.requested).toEqual([]);
  });

  it('chunks large batches and preserves individual read isolation', async () => {
    const all = Array.from({ length: 85 }, (_, index) => 'user-' + index);
    const [large, small] = await Promise.all([
      fetchPublicProfilesBatched(all),
      fetchPublicProfilesBatched(['user-84']),
    ]);
    expect(state.requested.map(ids => ids.length)).toEqual([80, 5]);
    expect(large.data).toHaveLength(85);
    expect(small.data?.map(p => p.id)).toEqual(['user-84']);
  });

  it('propagates failures to all callers and retries on subsequent batches', async () => {
    state.failure = true;
    const [first, second] = await Promise.all([
      fetchPublicProfilesBatched(['a']),
      fetchPublicProfilesBatched(['a', 'b']),
    ]);
    expect(first.data).toBeNull();
    expect(second.error?.message).toBe('Public profile query failed');
    state.failure = false;
    const retry = await fetchPublicProfilesBatched(['a']);
    expect(retry.data?.[0]?.id).toBe('a');
    expect(state.requested).toHaveLength(2);
  });
});
