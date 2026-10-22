import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import Feed from './Feed';
import { mockSupabaseClient, resetMocks } from '@/test/mocks/supabase';

// Mock the supabase client (async factory + dynamic import to avoid hoisting issues)
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseClient } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabaseClient };
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    profile: { display_name: 'Test User' },
  }),
}));

// Mock data for posts
const mockPosts = [
  {
    id: 'post-1',
    user_id: 'user-1',
    type: 'text',
    content: 'First test post',
    media_urls: [],
    location: 'Talatona',
    privacy: 'everyone',
    is_pinned: false,
    likes_count: 5,
    comments_count: 2,
    shares_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      id: 'user-1',
      display_name: 'User One',
      username: 'userone',
      avatar_url: null,
    },
    is_liked: false,
    is_saved: false,
    my_reaction: null,
  },
  {
    id: 'post-2',
    user_id: 'user-2',
    type: 'photo',
    content: 'Second post with photo',
    media_urls: ['https://example.com/photo.jpg'],
    location: 'Patriota',
    privacy: 'everyone',
    is_pinned: false,
    likes_count: 10,
    comments_count: 3,
    shares_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      id: 'user-2',
      display_name: 'User Two',
      username: 'usertwo',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    is_liked: true,
    is_saved: true,
    my_reaction: 'like',
  },
];

// Mock usePosts hook with different states
let mockLoading = false;
let mockFeedPosts = mockPosts;

vi.mock('@/hooks/usePosts', () => ({
  usePosts: () => ({
    feedPosts: mockFeedPosts,
    loading: mockLoading,
    toggleLike: vi.fn(),
    toggleSave: vi.fn(),
    deletePost: vi.fn(),
    sharePost: vi.fn(),
  }),
  PostWithUser: {},
}));

// Mock advertising hook — return the posts unchanged (no ads interleaved).
// Use stable references so effect dependency arrays don't change every render.
vi.mock('@/hooks/useAdvertising', () => {
  const fetchActiveAdsForFeed = vi.fn().mockResolvedValue([]);
  const interleaveAdsInFeed = <T,>(posts: T[]) => posts;
  return {
    useAdvertising: () => ({ fetchActiveAdsForFeed, interleaveAdsInFeed }),
    Advertisement: {},
    BusinessProfile: {},
  };
});

// Mock active streams hook (stable empty state).
vi.mock('@/hooks/useActiveStreams', () => {
  const activeStreams: unknown[] = [];
  return {
    useActiveStreams: () => ({
      hasActiveStreams: false,
      activeStreams,
      activeCount: 0,
      loading: false,
    }),
  };
});

// Mock archived posts hook (stable references).
vi.mock('@/hooks/useArchivedPosts', () => {
  const archivedPostIds = new Set<string>();
  const fetchArchivedIds = vi.fn();
  const toggleArchive = vi.fn();
  const isArchived = () => false;
  return {
    useArchivedPosts: () => ({
      archivedPostIds,
      fetchArchivedIds,
      toggleArchive,
      isArchived,
    }),
  };
});

// Mock StatusList component
vi.mock('@/components/status/StatusList', () => ({
  StatusList: () => <div data-testid="status-list">Status List</div>,
}));

// Mock CreatePostSheet
vi.mock('@/components/feed/CreatePostSheet', () => ({
  CreatePostSheet: ({ open }: { open: boolean }) => 
    open ? <div data-testid="create-post-sheet">Create Post Sheet</div> : null,
}));

// Mock CommentsSheet
vi.mock('@/components/feed/CommentsSheet', () => ({
  CommentsSheet: ({ open }: { open: boolean }) => 
    open ? <div data-testid="comments-sheet">Comments Sheet</div> : null,
}));

describe('Feed Page', () => {
  beforeEach(() => {
    resetMocks();
    mockNavigate.mockClear();
    mockLoading = false;
    mockFeedPosts = mockPosts;
  });

  it('renders the header with the Yamilook logo', () => {
    render(<Feed />);
    // The header brand is an image logo, not text.
    expect(screen.getAllByAltText('Yamilook').length).toBeGreaterThan(0);
  });

  it('renders navigation icons in header', () => {
    const { container } = render(<Feed />);
    
    // Should have search, bell, and message icons in header
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    
    const buttons = header?.querySelectorAll('button');
    expect(buttons?.length).toBeGreaterThanOrEqual(3);
  });

  it('renders StatusList component', () => {
    render(<Feed />);
    expect(screen.getByTestId('status-list')).toBeInTheDocument();
  });

  it('renders posts when available', async () => {
    render(<Feed />);

    // Posts are interleaved with ads asynchronously, so wait for them.
    expect(await screen.findByText('First test post')).toBeInTheDocument();
    expect(await screen.findByText('Second post with photo')).toBeInTheDocument();
  });

  it('renders user names in posts', async () => {
    render(<Feed />);

    expect(await screen.findByText('User One')).toBeInTheDocument();
    expect(await screen.findByText('User Two')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    mockLoading = true;
    const { container } = render(<Feed />);

    // FeedSkeleton renders shimmer-loading placeholder elements.
    const skeletons = container.querySelectorAll('.shimmer-loading');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no posts', () => {
    mockFeedPosts = [];
    render(<Feed />);

    expect(
      screen.getByText('Ainda não há partilhas na tua comunidade')
    ).toBeInTheDocument();
    expect(screen.getByText(/Partilha o que se passa/)).toBeInTheDocument();
  });

  it('shows create post button in empty state', () => {
    mockFeedPosts = [];
    render(<Feed />);
    
    expect(screen.getByText('Criar publicação')).toBeInTheDocument();
  });

  it('renders FAB (floating action button) for creating posts', () => {
    const { container } = render(<Feed />);
    
    // FAB should be a fixed button with Plus icon
    const fab = container.querySelector('button.fixed');
    expect(fab).toBeInTheDocument();
  });

  it('opens create post sheet when FAB is clicked', async () => {
    render(<Feed />);
    
    // Find the FAB by its fixed position class
    const fab = document.querySelector('button.fixed');
    expect(fab).toBeInTheDocument();
    
    if (fab) {
      fireEvent.click(fab);
      
      await waitFor(() => {
        expect(screen.getByTestId('create-post-sheet')).toBeInTheDocument();
      });
    }
  });

  it('opens create post sheet from empty state button', async () => {
    mockFeedPosts = [];
    render(<Feed />);
    
    const createButton = screen.getByText('Criar publicação');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('create-post-sheet')).toBeInTheDocument();
    });
  });

  it('renders bottom navigation', () => {
    render(<Feed />);

    expect(screen.getByText('Muxi')).toBeInTheDocument();
    expect(screen.getByText('Mokubico')).toBeInTheDocument();
    expect(screen.getByText('Academia')).toBeInTheDocument();
    expect(screen.getByText('Papos')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('links Papos nav item to the papos route', () => {
    render(<Feed />);

    const paposLink = screen.getByText('Papos').closest('a');
    expect(paposLink).toHaveAttribute('href', '/papos');
  });

  it('links Mokubico nav item to the home route', () => {
    render(<Feed />);

    const mokubicoLink = screen.getByText('Mokubico').closest('a');
    expect(mokubicoLink).toHaveAttribute('href', '/mokubico');
  });

  it('links Perfil nav item to the profile route', () => {
    render(<Feed />);

    const perfilLink = screen.getByText('Perfil').closest('a');
    expect(perfilLink).toHaveAttribute('href', '/perfil');
  });

  it('navigates to discover when the header search icon is clicked', () => {
    const { container } = render(<Feed />);

    // The header has three icon buttons: live, search, messages.
    const header = container.querySelector('header');
    const buttons = header?.querySelectorAll('button');
    // The second button is the search icon (navigates to /discover).
    fireEvent.click(buttons![1]);

    expect(mockNavigate).toHaveBeenCalledWith('/discover');
  });

  it('navigates to messages when message icon is clicked', () => {
    const { container } = render(<Feed />);
    
    // Find buttons in header
    const header = container.querySelector('header');
    const buttons = header?.querySelectorAll('button');
    
    if (buttons && buttons.length >= 3) {
      fireEvent.click(buttons[2]); // Third button should be messages
      expect(mockNavigate).toHaveBeenCalledWith('/');
    }
  });

  it('renders correct number of posts', async () => {
    render(<Feed />);

    // We have 2 mock posts; wait for the async interleave to render them.
    await screen.findByText('First test post');
    const articles = document.querySelectorAll('article');
    expect(articles.length).toBe(2);
  });

  it('renders all five bottom-nav items', () => {
    render(<Feed />);

    const navLinks = document.querySelectorAll('nav a');
    expect(navLinks.length).toBe(5);
  });

  it('applies proper layout classes', () => {
    const { container } = render(<Feed />);
    
    // Main container should be min-h-screen and flex column
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('min-h-screen');
    expect(mainDiv).toHaveClass('flex');
    expect(mainDiv).toHaveClass('flex-col');
  });

  it('has sticky header', () => {
    const { container } = render(<Feed />);
    
    const header = container.querySelector('header');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
  });

  it('has fixed bottom navigation', () => {
    render(<Feed />);

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(nav).toHaveClass('fixed');
    expect(nav).toHaveClass('bottom-0');
  });
});
