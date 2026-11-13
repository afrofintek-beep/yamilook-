import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PostWithUser } from '@/hooks/usePosts';
import { ProfilePostPhotos } from './ProfilePostPhotos';
vi.mock('@/i18n/ui-copy', () => ({ uiText: (s: string) => s, useUiLocale: () => 'pt' }));
afterEach(() => { cleanup(); localStorage.clear(); });
const posts = [
  { id: 'a', type: 'photo', media_urls: ['one.jpg', 'two.jpg'], content: 'Legenda' },
  { id: 'b', type: 'video', media_urls: ['movie.mp4'] },
  { id: 'c', type: 'text', media_urls: [] },
] as PostWithUser[];
it('shows each authorized photo and opens the clicked image, navigates and links its post', () => {
  const onOpenPost = vi.fn();
  render(<ProfilePostPhotos posts={posts} onOpenPost={onOpenPost} />);
  expect(screen.getAllByRole('button', { name: /Abrir fotografia/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir fotografia 2' }));
  expect(screen.getByRole('img', { name: 'Legenda' })).toHaveAttribute('src', 'two.jpg');
  fireEvent.click(screen.getByRole('button', { name: 'Fotografia anterior' }));
  expect(screen.getByRole('img', { name: 'Legenda' })).toHaveAttribute('src', 'one.jpg');
  fireEvent.click(screen.getByRole('button', { name: 'Ver publicação' }));
  expect(onOpenPost).toHaveBeenCalledWith(posts[0]);
});
it('removes the viewer when the selected photo is no longer authorized', () => {
  const view = render(<ProfilePostPhotos posts={posts} onOpenPost={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir fotografia 1' }));
  view.rerender(<ProfilePostPhotos posts={[]} onOpenPost={vi.fn()} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('persists the chosen layout', () => {
  render(<ProfilePostPhotos posts={posts} onOpenPost={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
  expect(localStorage.setItem).toHaveBeenCalledWith('profile-photo-layout', 'list');
  expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
});
