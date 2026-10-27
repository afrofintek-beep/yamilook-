import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { PostCard } from './PostCard';
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

// Mock usePosts hook
const mockToggleLike = vi.fn();
const mockToggleSave = vi.fn();
const mockDeletePost = vi.fn();
const mockSharePost = vi.fn();

vi.mock('@/hooks/usePosts', () => ({
  usePosts: () => ({
    toggleLike: mockToggleLike,
    toggleSave: mockToggleSave,
    deletePost: mockDeletePost,
    sharePost: mockSharePost,
  }),
  PostWithUser: {},
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('PostCard', () => {
  const mockPost = {
    id: 'post-1',
    user_id: 'user-1',
    type: 'photo' as const,
    content: 'This is a test post content',
    media_urls: ['https://example.com/image.jpg'],
    location: 'Talatona',
    privacy: 'everyone' as const,
    is_pinned: false,
    likes_count: 10,
    comments_count: 5,
    shares_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      id: 'user-1',
      display_name: 'Test User',
      username: 'testuser',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    is_liked: false,
    is_saved: false,
    my_reaction: null,
    reaction_counts: {
      sankofa: 10,
      ubuntu: 0,
      djembe: 0,
      shango: 0,
      eish: 0,
    },
  };

  beforeEach(() => {
    resetMocks();
    mockNavigate.mockClear();
    mockToggleLike.mockClear();
    mockToggleSave.mockClear();
    mockDeletePost.mockClear();
    mockSharePost.mockClear();
  });

  it('does not query moderator permissions for a closed report sheet', () => {
    render(<PostCard post={mockPost} />);
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalledWith(
      'is_moderator_or_admin', expect.anything()
    );
  });

  it('renders post content correctly', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('This is a test post content')).toBeInTheDocument();
  });

  it('renders user display name', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders location when provided', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('Talatona')).toBeInTheDocument();
  });

  it('does not render location when not provided', () => {
    const postWithoutLocation = { ...mockPost, location: null };
    render(<PostCard post={postWithoutLocation} />);
    expect(screen.queryByText('Talatona')).not.toBeInTheDocument();
  });

  it('renders reactions total', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText(/10 reactions/i)).toBeInTheDocument();
  });

  it('renders comments count', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders media image', () => {
    render(<PostCard post={mockPost} />);
    // Media images in the carousel use an empty alt (presentational), so query by src.
    const mediaImage = document.querySelector('img[src="https://example.com/image.jpg"]');
    expect(mediaImage).toBeInTheDocument();
  });

  it('renders multiple media items', () => {
    const postWithMultipleMedia = {
      ...mockPost,
      media_urls: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ],
    };
    render(<PostCard post={postWithMultipleMedia} />);
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('renders all media items in a carousel with a counter', () => {
    const postWithManyMedia = {
      ...mockPost,
      media_urls: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
        'https://example.com/image4.jpg',
        'https://example.com/image5.jpg',
        'https://example.com/image6.jpg',
      ],
    };
    render(<PostCard post={postWithManyMedia} />);
    // The media carousel renders every item and shows an "index/total" counter.
    const mediaImages = document.querySelectorAll('img[src^="https://example.com/image"]');
    expect(mediaImages.length).toBe(6);
    expect(screen.getByText('1/6')).toBeInTheDocument();
  });

  it('calls toggleLike when like button is clicked', async () => {
    render(<PostCard post={mockPost} />);

    // The like button contains the default reaction icon labelled "React".
    const buttons = screen.getAllByRole('button');
    const likeButton = buttons.find(btn => btn.querySelector('[aria-label="React"]'));
    expect(likeButton).toBeDefined();

    // jsdom exposes `ontouchstart`, so the component treats it as a touch device
    // and drives quick-react through touchStart/touchEnd (a short, non-long-press tap).
    fireEvent.touchStart(likeButton!);
    fireEvent.touchEnd(likeButton!);

    await waitFor(() => {
      expect(mockToggleLike).toHaveBeenCalledWith('post-1', 'sankofa');
    });
  });

  it('shows filled bookmark when post is saved', () => {
    const savedPost = { ...mockPost, is_saved: true };
    const { container } = render(<PostCard post={savedPost} />);
    
    const filledBookmark = container.querySelector('.fill-current');
    expect(filledBookmark).toBeInTheDocument();
  });

  it('calls onCommentClick when comment button is clicked', () => {
    const handleCommentClick = vi.fn();
    render(<PostCard post={mockPost} onCommentClick={handleCommentClick} />);
    
    // Find the comment button by looking for MessageCircle icon container
    const buttons = screen.getAllByRole('button');
    // The comment button should have the comments count nearby
    const commentButton = buttons.find(btn => 
      btn.textContent?.includes('5') && btn.querySelector('svg')
    );
    
    if (commentButton) {
      fireEvent.click(commentButton);
      expect(handleCommentClick).toHaveBeenCalled();
    }
  });

  it('navigates to user profile when clicking on user info', () => {
    render(<PostCard post={mockPost} />);
    
    const userName = screen.getByText('Test User');
    fireEvent.click(userName);
    
    expect(mockNavigate).toHaveBeenCalledWith('/profile/user-1');
  });

  const openOptionsMenu = () => {
    // The options menu trigger is the Radix dropdown button (aria-haspopup="menu").
    const menuButton = screen.getAllByRole('button').find(
      btn => btn.getAttribute('aria-haspopup') === 'menu'
    );
    expect(menuButton).toBeDefined();
    // Radix DropdownMenu opens on pointerdown in jsdom.
    fireEvent.pointerDown(
      menuButton!,
      new window.PointerEvent('pointerdown', { bubbles: true, button: 0 })
    );
    fireEvent.click(menuButton!);
  };

  it('shows delete option for post owner', async () => {
    const ownPost = { ...mockPost, user_id: 'test-user-id' };
    render(<PostCard post={ownPost} />);

    openOptionsMenu();

    await waitFor(() => {
      // PT label for the delete action.
      expect(screen.getByText('Apagar publicação')).toBeInTheDocument();
    });
  });

  it('shows report option for non-owner', async () => {
    render(<PostCard post={mockPost} />);

    openOptionsMenu();

    await waitFor(() => {
      // PT label for the report action.
      expect(screen.getByText('Denunciar')).toBeInTheDocument();
    });
  });

  it('shows reaction emoji when post is liked', () => {
    const likedPost = { ...mockPost, is_liked: true, my_reaction: 'love' };
    render(<PostCard post={likedPost} />);
    
    // legacy 'love' should normalize to Sankofa
    expect(screen.getByText('💛')).toBeInTheDocument();
  });

  it('renders without content when content is null', () => {
    const postWithoutContent = { ...mockPost, content: null };
    render(<PostCard post={postWithoutContent} />);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.queryByText('This is a test post content')).not.toBeInTheDocument();
  });

  it('renders video player for video media', () => {
    const videoPost = {
      ...mockPost,
      media_urls: ['https://example.com/video.mp4'],
    };
    const { container } = render(<PostCard post={videoPost} />);
    
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('preload', 'none');
    // Offscreen video sources are deferred until the viewport observer fires.
    expect(video).not.toHaveAttribute('src');
  });

  it('displays relative time for post creation', () => {
    render(<PostCard post={mockPost} />);
    // Should show something like "less than a minute ago" or similar
    const timeText = screen.getByText(/ago|just now/i);
    expect(timeText).toBeInTheDocument();
  });

  it('renders user avatar fallback when no avatar', () => {
    const postWithoutAvatar = {
      ...mockPost,
      user: { ...mockPost.user, avatar_url: null },
    };
    render(<PostCard post={postWithoutAvatar} />);
    
    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of "Test User"
  });
});
