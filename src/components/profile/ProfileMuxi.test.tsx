import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUserPosts: vi.fn() }));
vi.mock('@/hooks/usePosts', () => ({ usePosts: () => ({ getUserPosts: mocks.getUserPosts }) }));
vi.mock('@/components/feed/PostCard', () => ({ PostCard: ({ post }: { post: { content: string } }) => <p>{post.content}</p> }));
vi.mock('@/components/feed/CommentsSheet', () => ({ CommentsSheet: () => null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
import { ProfileMuxi } from './ProfileMuxi';
afterEach(() => { cleanup(); mocks.getUserPosts.mockReset(); });
it('shows the selected friend posts and never retains the previous profile feed', async () => {
  mocks.getUserPosts.mockImplementation(async (id: string) => [{ id, content: `Muxi de ${id}` }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><ProfileMuxi userId="amigo-a" /></QueryClientProvider>);
  expect(await screen.findByText('Muxi de amigo-a')).toBeVisible();
  view.rerender(<QueryClientProvider client={client}><ProfileMuxi userId="amigo-b" /></QueryClientProvider>);
  expect(screen.queryByText('Muxi de amigo-a')).not.toBeInTheDocument();
  expect(await screen.findByText('Muxi de amigo-b')).toBeVisible();
  expect(mocks.getUserPosts).toHaveBeenLastCalledWith('amigo-b');
  client.clear();
});
it('shows an empty state for posts not visible to the viewer', async () => {
  mocks.getUserPosts.mockResolvedValue([]);
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><ProfileMuxi userId="amigo" /></QueryClientProvider>);
  expect(await screen.findByText('Sem publicações disponíveis para ti neste perfil.')).toBeVisible();
  client.clear();
});
it('reports a failed request instead of treating it as an empty feed', async () => {
  mocks.getUserPosts.mockRejectedValue(new Error('Network'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ProfileMuxi userId="amigo" /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar'));
  client.clear();
});
