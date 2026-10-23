import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
import { usePosts } from './usePosts';
beforeEach(() => {
  mocks.from.mockReset(); mocks.eq.mockReset(); mocks.order.mockReset();
  mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) });
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.order.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);
it('fetches only the requested author without starting the general feed or discovery', async () => {
  const { result } = renderHook(() => usePosts({ autoLoad: false }));
  expect(mocks.from).not.toHaveBeenCalled();
  await act(async () => { await result.current.getUserPosts('friend-id'); });
  expect(mocks.from).toHaveBeenCalledExactlyOnceWith('posts');
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'friend-id');
});
it('propagates failures so the profile can offer a retry', async () => {
  const error = new Error('offline'); mocks.order.mockResolvedValue({ data: null, error });
  const { result } = renderHook(() => usePosts({ autoLoad: false }));
  await expect(result.current.getUserPosts('friend-id')).rejects.toBe(error);
});
