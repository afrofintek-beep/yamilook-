import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizePostText } from '../../shared/post-text.mjs';
import { renderPublicPost } from '../../server/public-post-page.mjs';
const links = text => tokenizePostText(text).filter(part => part.href);

test('campaign links work with and without a scheme, preserving all original text', () => {
  const text = 'Explora 👉 https://novidades.yamilook.com/\nConvite: convites.yamilook.com. E www.yamilook.com!';
  assert.deepEqual(links(text).map(part => part.href), ['https://novidades.yamilook.com/', 'https://convites.yamilook.com/', 'https://www.yamilook.com/']);
  assert.equal(tokenizePostText(text).map(part => part.text).join(''), text);
});
test('surrounding punctuation is excluded while balanced path parentheses and queries survive', () => {
  assert.equal(links('(https://example.com/a_(b)).')[0].href, 'https://example.com/a_(b)');
  assert.equal(links('https://example.com/?a=1&b=2#section')[0].href, 'https://example.com/?a=1&b=2#section');
  assert.equal(links('HTTP://example.com/path')[0].href, 'http://example.com/path');
});
test('non-web schemes, emails and credential-bearing URLs are not links', () => {
  for (const text of ['javascript:alert(1)', 'data:text/html,test', 'ftp://example.com', 'mailto:tony@example.com', 'tony@novidades.yamilook.com', 'javascript:https://example.com', 'https://user:pass@example.com', 'https://', 'example.com_invalid']) {
    assert.deepEqual(links(text), [], text);
  }
});
test('empty and ordinary text are preserved', () => {
  for (const text of ['', 'A tua banda. Mais perto.\n💛', '<script>alert(1)</script>']) {
    assert.deepEqual(links(text), []);
    assert.equal(tokenizePostText(text).map(part => part.text).join(''), text);
  }
});
test('public HTML makes links clickable, escapes text and attributes, and retains safe metadata', () => {
  const html = renderPublicPost({ id: 'be23e228-a441-44ea-a14c-5368fd8097a7', media_urls: [], author: { display_name: 'Tony' }, created_at: '2026-11-07T10:00:00Z', content: '<img src=x onerror=alert(1)> https://novidades.yamilook.com/?a=1&b=2' });
  assert.match(html, /class="post-text-link" href="https:\/\/novidades.yamilook.com\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer ugc"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /content="<a/);
});
