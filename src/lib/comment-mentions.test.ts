import { describe, it, expect } from 'vitest';
import { activeMention, insertMention } from './comment-mentions';
describe('comment mentions', () => {
 it('recognizes partial names and ignores email addresses', () => {
  expect(activeMention('Thanks @est', 11)?.query).toBe('est');
  expect(activeMention('a@est', 5)).toBeNull();
  expect(activeMention('@', 1)?.query).toBe('');
 });
 it('preserves text around the cursor and replaces the remaining handle', () => {
  expect(insertMention('Hi @estella!', 7, 'estella').value).toBe('Hi @estella !');
  expect(insertMention('Hi @es and @tony', 6, 'estella').value).toBe('Hi @estella  and @tony');
 });
});
