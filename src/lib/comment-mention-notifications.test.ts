import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from, profile, comments, senders } = vi.hoisted(() => ({
  from: vi.fn(), profile: vi.fn(), comments: vi.fn(), senders: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { fetchCommentMentions } from './comment-mention-notifications';
let commentQuery: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  profile.mockResolvedValue({ data: { username: 'target_name' }, error: null });
  senders.mockResolvedValue({ data: [{ id: 'sender', display_name: 'Sender Name', avatar_url: 'photo' }] });
  comments.mockResolvedValue({ data: [], error: null });
  commentQuery = Object.fromEntries(['select','eq','ilike','neq','gte','order'].map(key => [key, vi.fn().mockReturnThis()]));
  commentQuery.limit = comments;
  from.mockImplementation(table => table === 'post_comments' ? commentQuery : {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: profile, in: senders,
  });
});
const mention = (content: string, id = 'comment') => ({ id, content, user_id: 'sender', post_id: 'post', created_at: '2026-11-05T12:00:00Z' });
describe('recipient mention notifications', () => {
  it('identifies the sender and links the accessible post', async () => {
    comments.mockResolvedValue({ data: [mention('Hello @TARGET_NAME!')] });
    expect(await fetchCommentMentions('recipient','2026-10-29')).toEqual([expect.objectContaining({
      id: 'mention_comment', title: 'Sender Name', avatar_url: 'photo', type: 'mention',
      action_data: { post_id: 'post', sender_id: 'sender' },
    })]);
    expect(commentQuery.select).toHaveBeenCalledWith(expect.stringContaining('posts!inner'));
    expect(commentQuery.eq).toHaveBeenCalledWith('is_hidden', false);
    expect(commentQuery.eq).toHaveBeenCalledWith('posts.is_hidden', false);
    expect(commentQuery.neq).toHaveBeenCalledWith('user_id','recipient');
    expect(commentQuery.ilike).toHaveBeenCalledWith('content','%@target\\_name%');
    expect(comments).toHaveBeenCalledWith(50);
  });
  it('rejects prefix matches and email addresses', async () => {
    comments.mockResolvedValue({ data: [mention('@target_name_extra'), mention('mail@target_name'), mention('@target_name.test')] });
    expect(await fetchCommentMentions('recipient','since')).toEqual([]);
    expect(senders).not.toHaveBeenCalled();
  });
  it('deduplicates repeated handles in one comment', async () => {
    comments.mockResolvedValue({ data: [mention('@target_name hello @target_name.')] });
    expect(await fetchCommentMentions('recipient','since')).toHaveLength(1);
  });
  it('does not invent a notification when RLS returns no accessible comments', async () => {
    expect(await fetchCommentMentions('recipient','since')).toEqual([]);
  });
  it('fails closed on a comment-query error even if data is present', async () => {
    comments.mockResolvedValue({ error: new Error('permission denied'), data: [mention('@target_name')] });
    expect(await fetchCommentMentions('recipient','since')).toEqual([]);
  });
  it('fails closed when the recipient profile is unavailable', async () => {
    profile.mockResolvedValue({ data: null, error: new Error('offline') });
    expect(await fetchCommentMentions('recipient','since')).toEqual([]);
    expect(comments).not.toHaveBeenCalled();
  });
});
