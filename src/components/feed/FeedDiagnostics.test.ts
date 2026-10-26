import { expect, it } from 'vitest';
import { resourceCategory } from './FeedDiagnostics';
it('never exposes signed media paths or query secrets', () => {
  expect(resourceCategory('https://example.com/storage/v1/object/sign/private/user/file.jpg?token=secret', 'fetch')).toBe('media');
  expect(resourceCategory('https://example.com/rest/v1/posts?user_id=private', 'fetch')).toBe('api:posts');
  expect(resourceCategory('https://example.com/rest/v1/rpc/private_function', 'fetch')).toBe('api:rpc');
  expect(resourceCategory('secret', 'private')).toBe('other');
});
it('separates pagination and discovery without exporting query values', () => {
  expect(resourceCategory('https://example.com/rest/v1/posts?created_at=lt.private', 'fetch')).toBe('api:posts:pagination');
  expect(resourceCategory('https://example.com/rest/v1/posts?order=likes_count.desc', 'fetch')).toBe('api:posts:discovery');
});
