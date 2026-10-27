import { describe, expect, it } from 'vitest';
import { chooseAuthorAvatarUrl } from './avatar-source';

describe('same avatar in own profile and feed', () => {
  it('uses authenticated profile image for own posts', () => {
    expect(chooseAuthorAvatarUrl('me', 'old.jpg', 'me', { id: 'me', avatar_url: 'new.jpg' }))
      .toBe('new.jpg');
  });
  it('respects removal of own profile image', () => {
    expect(chooseAuthorAvatarUrl('me', 'old.jpg', 'me', { id: 'me', avatar_url: null }))
      .toBeNull();
  });
  it('never substitutes the viewer image on posts by other members', () => {
    expect(chooseAuthorAvatarUrl('other', 'theirs.jpg', 'me', { id: 'me', avatar_url: 'mine.jpg' }))
      .toBe('theirs.jpg');
    expect(chooseAuthorAvatarUrl('me', 'original.jpg', 'me', null)).toBe('original.jpg');
  });
});
