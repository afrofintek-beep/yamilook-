import { describe, expect, it } from 'vitest';
import { optimizedPublicImageUrl } from './image-delivery';
const base = 'https://project.supabase.co';
const publicUrl = base + '/storage/v1/object/public/avatars/member/avatar.jpg';

describe('safe public image delivery', () => {
  it('keeps the original avatar and post proportions until transformations are validated', () => {
    expect(optimizedPublicImageUrl(publicUrl, 128, base)).toBe(publicUrl);
    expect(optimizedPublicImageUrl(publicUrl, 960, base)).toBe(publicUrl);
    expect(optimizedPublicImageUrl(base + '/storage/v1/object/public/media/post.jpg', 960, base))
      .toBe(base + '/storage/v1/object/public/media/post.jpg');
  });
  it('never rewrites a signed, query-bearing, private or third-party URL', () => {
    for (const src of [
      base + '/storage/v1/object/sign/media/user.jpg?token=secret',
      publicUrl + '?token=signed',
      'https://other.supabase.co/storage/v1/object/public/avatars/user.jpg',
      base + '/storage/v1/object/public/media/animated.gif',
      base + '/storage/v1/object/public/media/icon.svg',
      'data:image/png;base64,abcd',
    ]) expect(optimizedPublicImageUrl(src, 128, base)).toBe(src);
  });
  it('returns the original for unknown origin or invalid requested width', () => {
    expect(optimizedPublicImageUrl(publicUrl, 0, base)).toBe(publicUrl);
    expect(optimizedPublicImageUrl(publicUrl, 128, '')).toBe(publicUrl);
    expect(optimizedPublicImageUrl(undefined, 128, base)).toBeUndefined();
  });
});
