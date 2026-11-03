import { expect, it } from 'vitest';
import { legacyChatVoicePath } from './legacy-chat-voice';
const project = 'https://example.supabase.co';
it('resolves public, expired signed and authenticated voice URLs to the same object', () => {
  for (const mode of ['public', 'sign', 'authenticated']) {
    expect(legacyChatVoicePath(`${project}/storage/v1/object/${mode}/voice-messages/user/old%20voice.webm?token=expired`, project)).toBe('user/old voice.webm');
  }
});
it('rejects foreign origins, other buckets, malformed encodings and traversal', () => {
  for (const value of [
    'https://evil.example/storage/v1/object/public/voice-messages/u/f',
    `${project}/storage/v1/object/public/media/u/f`,
    `${project}/storage/v1/object/public/voice-messages/u/%QQ`,
    `${project}/storage/v1/object/public/voice-messages/u/%2e%2e%2ff`,
    `${project}/storage/v1/object/public/voice-messages/u/%00f`,
    `${project}/storage/v1/object/public/voice-messages/u//f`,
  ]) expect(legacyChatVoicePath(value, project)).toBeNull();
});
