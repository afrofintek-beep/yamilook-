import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import PaposProfile from './PaposProfile';

const fixtures = vi.hoisted(() => ({
  from: vi.fn(),
  saved: { id: 'me', display_name: 'Leticia Silva', username: 'leticia.lcs', avatar_url: 'https://example.com/current.jpg', bio: '' },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, profile: { ...fixtures.saved, avatar_url: null } }) }));
vi.mock('@/hooks/useChat', () => ({ useConversations: () => ({ createConversation: vi.fn() }) }));
vi.mock('@/components/calls/ActiveCallProvider', () => ({ useActiveCall: () => null }));
vi.mock('@/components/BottomNav', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: fixtures.from } }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: () => null,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); focusManager.setFocused(undefined); });
function draw(path = '/profile') {
  fixtures.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...fixtures.saved }, error: null }) }) }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/profile" element={<PaposProfile />} /><Route path="/profile/:userId" element={<PaposProfile />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
it('loads the saved own photo even when the auth profile has no photo', async () => {
  draw();
  await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', fixtures.saved.avatar_url));
  expect(fixtures.from).toHaveBeenCalledWith('profiles');
});
it('refreshes the own photo on return despite the global focus setting', async () => {
  draw();
  await waitFor(() => expect(fixtures.from).toHaveBeenCalledOnce());
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await waitFor(() => expect(fixtures.from).toHaveBeenCalledTimes(2));
});
it('reads another member through public profiles', async () => {
  draw('/profile/other');
  await screen.findByRole('img');
  expect(fixtures.from).toHaveBeenCalledWith('public_profiles');
  expect(fixtures.from).not.toHaveBeenCalledWith('profiles');
});
