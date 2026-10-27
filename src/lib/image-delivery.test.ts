import { describe, expect, it } from 'vitest';
import { imageFitsVariant, optimizedPublicImageUrl } from './image-delivery';

const project = 'https://project.supabase.co';
const publicUrl = project + '/storage/v1/object/public/avatars/member/avatar.jpg';
const profileVariant = { width: 160, height: 160, resize: 'cover' as const, quality: 78 };
const postVariant = { width: 960, height: 1920, resize: 'contain' as const, quality: 76 };

describe('privacy-safe, proportional public image variants', () => {
  it('bounds both dimensions and explicitly specifies the resize mode', () => {
    expect(optimizedPublicImageUrl(publicUrl, profileVariant, project))
      .toBe(project + '/storage/v1/render/image/public/avatars/member/avatar.jpg?width=160&height=160&resize=cover&quality=78');
    expect(optimizedPublicImageUrl(publicUrl, postVariant, project))
      .toContain('width=960&height=1920&resize=contain&quality=76');
  });

  it('never rewrites a private, signed, query-bearing, external, animated or SVG URL', () => {
    for (const src of [
      project + '/storage/v1/object/sign/media/user.jpg?token=private',
      publicUrl + '?token=signed',
      publicUrl + '#fragment',
      'https://other.supabase.co/storage/v1/object/public/avatars/user.jpg',
      project + '/storage/v1/object/public/media/animated.gif',
      project + '/storage/v1/object/public/media/icon.svg',
      'data:image/png;base64,abcd',
      '/relative/path.jpg',
    ]) expect(optimizedPublicImageUrl(src, profileVariant, project)).toBe(src);
  });

  it('rejects unsafe dimensions, modes and missing URLs', () => {
    expect(optimizedPublicImageUrl(publicUrl, { ...postVariant, height: 3000 }, project)).toBe(publicUrl);
    expect(optimizedPublicImageUrl(publicUrl, { ...postVariant, resize: 'fill' as 'contain' }, project)).toBe(publicUrl);
    expect(optimizedPublicImageUrl(publicUrl, profileVariant, '')).toBe(publicUrl);
    expect(optimizedPublicImageUrl(undefined, profileVariant, project)).toBeUndefined();
  });

  it('rejects previously seen distorted iPhone geometry', () => {
    expect(imageFitsVariant(128, 3088, profileVariant)).toBe(false);
    expect(imageFitsVariant(160, 160, profileVariant)).toBe(true);
    expect(imageFitsVariant(960, 1200, postVariant)).toBe(true);
    expect(imageFitsVariant(960, 3088, postVariant)).toBe(false);
    expect(imageFitsVariant(0, 0, postVariant)).toBe(false);
  });
});
