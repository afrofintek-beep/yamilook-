import { expect, it } from 'vitest';
import { resourceCategory, imageExceedsPixelBudget } from './FeedDiagnostics';
it('never exposes signed media paths or query secrets', () => {
  expect(resourceCategory('https://example.com/storage/v1/object/sign/private/user/file.jpg?token=secret', 'fetch')).toBe('media:other');
  expect(resourceCategory('https://example.com/rest/v1/posts?user_id=private', 'fetch')).toBe('api:posts');
  expect(resourceCategory('https://example.com/rest/v1/rpc/private_function', 'fetch')).toBe('api:rpc');
  expect(resourceCategory('secret', 'private')).toBe('other');
});
it('separates pagination and discovery without exporting query values', () => {
  expect(resourceCategory('https://example.com/rest/v1/posts?created_at=lt.private', 'fetch')).toBe('api:posts:pagination');
  expect(resourceCategory('https://example.com/rest/v1/posts?order=likes_count.desc', 'fetch')).toBe('api:posts:discovery');
});

it('keeps transformed image and call-poll counters anonymous', () => {
  expect(resourceCategory('https://example.com/storage/v1/render/image/public/media/photo.jpg?width=128', 'img')).toBe('media:transformed-image');
  expect(resourceCategory('https://example.com/storage/v1/object/public/media/photo.jpg', 'img')).toBe('media:public-object');
  expect(resourceCategory('https://example.com/rest/v1/call_participants?user_id=eq.private', 'fetch')).toBe('api:call_participants');
});

it('counts oversizing against physical pixels, not CSS pixels alone', () => {
  // iPhone 3x: a 160x160 thumbnail at 40x40 CSS px is appropriately sized.
  expect(imageExceedsPixelBudget(160, 160, 40, 40, 3)).toBe(false);
  // Prior release used a 2316x3088 original for the same avatar.
  expect(imageExceedsPixelBudget(2316, 3088, 40, 40, 3)).toBe(true);
  expect(imageExceedsPixelBudget(402, 301, 402, 302, 3)).toBe(false);
  expect(imageExceedsPixelBudget(0, 0, 40, 40, 3)).toBe(false);
  expect(imageExceedsPixelBudget(160, 160, 40, 40, 0)).toBe(false);
});

it('identifies same-origin JS module preloads without revealing file names', () => {
  const origin = window.location.origin;
  expect(resourceCategory(origin + '/assets/CreatePostSheet-abc123.js?token=hidden', 'link')).toBe('asset:script');
  expect(resourceCategory(origin + '/assets/feed-abc123.css', 'link')).toBe('asset:style');
  expect(resourceCategory(origin + '/assets/type-abc123.woff2', 'css')).toBe('asset:font');
  expect(resourceCategory('https://untrusted.example/assets/private.js?key=secret', 'link')).toBe('other');
});
