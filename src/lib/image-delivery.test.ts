import { describe, expect, it } from 'vitest';
import { optimizedPublicImageUrl } from './image-delivery';
const base = 'https://project.supabase.co';
const publicUrl = base + '/storage/v1/object/public/avatars/member/avatar.jpg';

describe('safe public image delivery', () => {
  it('requests a small transformed avatar and full-width post image', () => {
    expect(optimizedPublicImageUrl(publicUrl, 128, base))
      .toBe(base + '/storage/v1/render/image/public/avatars/member/avatar.jpg?width=128&quality=75');
    expect(optimizedPublicImageUrl(publicUrl, 960, base)).toContain('width=960');
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
