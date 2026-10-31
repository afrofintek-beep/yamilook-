import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  user: { id: 'viewer' } as { id: string } | null,
  from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(),
  realtime: null as null | ((payload: any) => void),
  pages: [] as any[],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { usePosts } from './usePosts';
const post = (i: number) => ({ id: `post-${i}`, user_id: 'author', type: 'text',
  content: `Post ${i}`, media_urls: [], privacy: 'everyone', likes_count: 0,
  comments_count: 0, shares_count: 0, is_pinned: false, location: null,
  created_at: new Date(Date.UTC(2026, 9, 31) - i * 1000).toISOString(),
  updated_at: '2026-10-31T00:00:00Z' });
const first = () => Array.from({ length: 20 }, (_, i) => post(i));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'viewer' };
  mocks.pages = [first(), [post(20), post(21)]];
  mocks.rpc.mockResolvedValue({ data: [{ id: 'author', display_name: 'Author' }] });
  mocks.channel.mockImplementation(() => {
    const channel = { on: vi.fn((_event, _filter, callback) => { mocks.realtime = callback; return channel; }), subscribe: vi.fn(() => channel) };
    return channel;
  });
  mocks.from.mockImplementation((table: string) => {
    const query: any = {};
    for (const method of ['select', 'eq', 'or', 'order', 'lt', 'in']) query[method] = vi.fn(() => query);
    query.limit = vi.fn(async () => ({ data: await mocks.pages.shift(), error: null }));
    query.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
    return query;
  });
});
afterEach(cleanup);
const mount = () => renderHook(() => usePosts({ loadDiscovery: false }));
const postsReads = () => mocks.from.mock.calls.filter(([table]) => table === 'posts').length;
it('keeps every loaded page and its callbacks when auth renews the same account', async () => {
  const { result, rerender } = mount();
  await waitFor(() => expect(result.current.feedPosts).toHaveLength(20));
  await act(async () => { await result.current.loadMoreFeedPosts(); });
  expect(result.current.feedPosts).toHaveLength(22);
  const refresh = result.current.fetchFeedPosts;
  const reads = postsReads();
  mocks.user = { id: 'viewer' };
  rerender();
  await act(async () => {});
  expect(result.current.fetchFeedPosts).toBe(refresh);
  expect(result.current.feedPosts.map(p => p.id)).toEqual([...first(), post(20), post(21)].map(p => p.id));
  expect(postsReads()).toBe(reads);
});
it('updates loaded posts in place and announces new posts without replacing the list', async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.feedPosts).toHaveLength(20));
  const reads = postsReads();
  await act(async () => { mocks.realtime!({ eventType: 'UPDATE', new: { ...post(5), likes_count: 3 } }); });
  expect(result.current.feedPosts[5].likes_count).toBe(3);
  expect(result.current.feedPosts).toHaveLength(20);
  await act(async () => { mocks.realtime!({ eventType: 'INSERT', new: post(-1) }); });
  expect(result.current.newPostsCount).toBe(1);
  expect(result.current.feedPosts[0].id).toBe('post-0');
  expect(postsReads()).toBe(reads);
});
it('removes a deleted post and a post whose audience changes without reloading page one', async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.feedPosts).toHaveLength(20));
  const reads = postsReads();
  await act(async () => {
    mocks.realtime!({ eventType: 'DELETE', old: { id: 'post-4' } });
    mocks.realtime!({ eventType: 'UPDATE', new: { ...post(5), privacy: 'only_me' } });
  });
  expect(result.current.feedPosts).toHaveLength(18);
  expect(result.current.feedPosts.some(p => ['post-4', 'post-5'].includes(p.id))).toBe(false);
  expect(postsReads()).toBe(reads);
});
it('still replaces the feed when explicitly refreshed', async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.feedPosts).toHaveLength(20));
  await act(async () => { await result.current.loadMoreFeedPosts(); });
  mocks.pages.push([post(-1)]);
  await act(async () => { await result.current.fetchFeedPosts(); });
  expect(result.current.feedPosts.map(p => p.id)).toEqual(['post--1']);
});
it('discards late pagination after an explicit refresh', async () => {
  const { result } = mount();
  await waitFor(() => expect(result.current.feedPosts).toHaveLength(20));
  let release!: (posts: any[]) => void;
  mocks.pages = [new Promise(resolve => { release = resolve; }), [post(-1)]];
  let pagination!: Promise<void>;
  act(() => { pagination = result.current.loadMoreFeedPosts(); });
  await act(async () => { await result.current.fetchFeedPosts(); });
  await act(async () => { release([post(20)]); await pagination; });
  expect(result.current.feedPosts.map(p => p.id)).toEqual(['post--1']);
});
it('clears old posts on account change and ignores a late request from that account', async () => {
  const { result, rerender } = mount();
  await waitFor(() => expect(result.current.feedPosts).toHaveLength(20));
  let release!: (posts: any[]) => void;
  mocks.pages = [new Promise(resolve => { release = resolve; }), [post(99)]];
  let pagination!: Promise<void>;
  act(() => { pagination = result.current.loadMoreFeedPosts(); });
  mocks.user = { id: 'other-viewer' };
  rerender();
  await waitFor(() => expect(result.current.feedPosts.map(p => p.id)).toEqual(['post-99']));
  await act(async () => { release([post(20)]); await pagination; });
  expect(result.current.feedPosts.map(p => p.id)).toEqual(['post-99']);
  mocks.user = null;
  rerender();
  expect(result.current.feedPosts).toEqual([]);
});
