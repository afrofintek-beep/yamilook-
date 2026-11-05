import { beforeEach, expect, it, vi } from 'vitest';
const { from, post, profile } = vi.hoisted(() => ({ from: vi.fn(), post: vi.fn(), profile: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { loadNotificationPost } from './notification-post';
beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(table => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: table === 'posts' ? post : profile }));
});
it('rechecks access and opens the exact post referred by a notification', async () => {
  post.mockResolvedValue({ data: { id:'post', user_id:'author', type:'text', privacy:'contacts' } });
  profile.mockResolvedValue({ data: { display_name:'Author', username:'author', avatar_url:null } });
  expect(await loadNotificationPost('post')).toMatchObject({id:'post', privacy:'contacts', user:{id:'author',username:'author'}});
});
it('returns unavailable after permission is revoked', async () => {
  post.mockResolvedValue({ data:null });
  expect(await loadNotificationPost('post')).toBeNull();
  expect(profile).not.toHaveBeenCalled();
});
it('reports query failures without showing cached content', async () => {
  post.mockResolvedValue({ error:new Error('offline') });
  await expect(loadNotificationPost('post')).rejects.toThrow('offline');
});
