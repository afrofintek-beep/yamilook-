import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCachedList } from './useCachedList';
import { clearListCache, listCacheKey, readListCache, writeListCache } from '@/lib/list-cache';
type Row = { id: string; name?: string };
beforeEach(() => { vi.stubGlobal('localStorage', window.sessionStorage); clearListCache(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(['conversations', 'contacts', 'calls'])('opens %s synchronously on return while the network has not answered', list => {
  const first = renderHook(() => useCachedList<Row>('a', list));
  expect(first.result.current.loading).toBe(true);
  act(() => { first.result.current.setItems([{ id: 'recent' }]); first.result.current.setLoading(false); });
  first.unmount();
  const reopened = renderHook(() => useCachedList<Row>('a', list));
  expect(reopened.result.current.items).toEqual([{ id: 'recent' }]);
  expect(reopened.result.current.loading).toBe(false);
  act(() => reopened.result.current.setItems([{ id: 'fresh' }]));
  expect(reopened.result.current.items).toEqual([{ id: 'fresh' }]);
});
it('never flashes another account or accepts its delayed response, even after switching back', () => {
  const h = renderHook(({ user }) => useCachedList<Row>(user, 'contacts'), { initialProps: { user: 'a' } });
  act(() => h.result.current.setItems([{ id: 'private-a' }]));
  const lateA = h.result.current.setItems;
  h.rerender({ user: 'b' });
  expect(h.result.current.items).toEqual([]);
  expect(h.result.current.loading).toBe(true);
  act(() => lateA([{ id: 'late-a' }]));
  expect(h.result.current.items).toEqual([]);
  h.rerender({ user: 'a' });
  act(() => lateA([{ id: 'late-a' }]));
  expect(h.result.current.items).toEqual([{ id: 'private-a' }]);
});
it('clears persisted lists on sign-out and rejects pending writes', () => {
  const h = renderHook(() => useCachedList<Row>('a', 'calls'));
  act(() => h.result.current.setItems([{ id: 'call' }]));
  const late = h.result.current.setItems;
  act(() => { clearListCache(); late([{ id: 'late' }]); });
  h.unmount();
  expect(readListCache(listCacheKey('a', 'calls'))).toBeUndefined();
  expect(renderHook(() => useCachedList<Row>('a', 'calls')).result.current.items).toEqual([]);
});
it('does not persist message previews or online presence and bounds the snapshot', () => {
  const key = listCacheKey('a', 'conversations');
  writeListCache(key, Array.from({ length: 120 }, (_, i) => ({ id: String(i), last_message: { content: 'secret', media_url: 'private' }, profile: { is_online: true } })));
  const raw = localStorage.getItem(key)!;
  expect(raw).not.toContain('secret'); expect(raw).not.toContain('private');
  expect(JSON.parse(raw).items).toHaveLength(100);
  expect(JSON.parse(raw).items[0].profile.is_online).toBe(false);
});
it('expires snapshots and tolerates malformed data', () => {
  const key = listCacheKey('a', 'contacts');
  writeListCache(key, [{ id: 'old' }]);
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_001);
  expect(readListCache(key)).toBeUndefined();
  localStorage.setItem(key, '{broken');
  expect(readListCache(key)).toBeUndefined();
});
it('continues displaying live data when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const h = renderHook(() => useCachedList<Row>('a', 'contacts'));
  act(() => { h.result.current.setItems([{ id: 'live' }]); h.result.current.setLoading(false); });
  expect(h.result.current.items).toEqual([{ id: 'live' }]);
  expect(h.result.current.loading).toBe(false);
});
it('reuses an empty successful list without a loader', () => {
  writeListCache(listCacheKey('a', 'calls'), []);
  const h = renderHook(() => useCachedList<Row>('a', 'calls'));
  expect(h.result.current.loading).toBe(false);
});

it('hydrates a persisted snapshot without an in-memory entry', () => {
 localStorage.setItem(listCacheKey('persisted-user', 'contacts'), JSON.stringify({expires:Date.now()+10000,items:[{id:'persisted'}]}));
 const h=renderHook(()=>useCachedList<Row>('persisted-user','contacts'));
 expect(h.result.current.items).toEqual([{id:'persisted'}]);
 expect(h.result.current.loading).toBe(false);
});
