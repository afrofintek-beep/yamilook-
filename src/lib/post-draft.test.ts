import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPostDraft, loadPostDraft, savePostDraft } from './post-draft';

describe('post drafts', () => {
  beforeEach(() => {
    const stored = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation(key => stored.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => { stored.set(key, value); });
    vi.mocked(localStorage.removeItem).mockImplementation(key => { stored.delete(key); });
    vi.mocked(localStorage.clear).mockImplementation(() => { stored.clear(); });
    localStorage.clear();
    vi.stubGlobal('indexedDB', undefined);
  });

  it('always preserves text and settings when local media storage is unavailable', async () => {
    const result = await savePostDraft('person-1', {
      content: 'Notícia importante',
      privacy: 'contacts',
      location: 'Luanda',
      selectedTopics: ['economia'],
      files: [new File(['video'], 'clip.mov', { type: 'video/quicktime' })],
    });

    expect(result.mediaSaved).toBe(false);
    await expect(loadPostDraft('person-1')).resolves.toMatchObject({
      content: 'Notícia importante',
      privacy: 'contacts',
      location: 'Luanda',
      selectedTopics: ['economia'],
      files: [],
      hadMedia: true,
    });
  });

  it('isolates drafts by account and clears only the requested account', async () => {
    await savePostDraft('person-1', { content: 'Um', privacy: 'contacts', location: '', selectedTopics: [], files: [] });
    await savePostDraft('person-2', { content: 'Dois', privacy: 'only_me', location: '', selectedTopics: [], files: [] });
    await clearPostDraft('person-1');

    await expect(loadPostDraft('person-1')).resolves.toBeNull();
    await expect(loadPostDraft('person-2')).resolves.toMatchObject({ content: 'Dois', privacy: 'only_me' });
  });
});
