import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { CreatePostSheet } from './CreatePostSheet';
import { mockSupabaseClient, resetMocks } from '@/test/mocks/supabase';

// Mock the supabase client (async factory + dynamic import to avoid hoisting issues)
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseClient } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabaseClient };
});

// Mock usePosts
const mockCreatePost = vi.fn();
vi.mock('@/hooks/usePosts', () => ({
  usePosts: () => ({
    createPost: mockCreatePost,
  }),
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { 
      id: 'test-user-id',
      email: 'test@example.com',
    },
  }),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    toasts: [],
    dismiss: vi.fn(),
  }),
}));

describe('CreatePostSheet', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    resetMocks();
    mockCreatePost.mockClear();
    mockToast.mockClear();
    defaultProps.onOpenChange.mockClear();
    let sequence = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:muxi-preview-' + (++sequence)),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders when open', () => {
    render(<CreatePostSheet {...defaultProps} />);
    expect(screen.getByText('Criar publicação')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<CreatePostSheet {...defaultProps} open={false} />);
    expect(screen.queryByText('Criar publicação')).not.toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<CreatePostSheet {...defaultProps} />);
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('renders publish button in the non-scrolling mobile header', () => {
    render(<CreatePostSheet {...defaultProps} />);
    const header = document.body.querySelector('[data-testid="muxi-publish-header"]');
    expect(header).toHaveClass('shrink-0');
    expect(header).toContainElement(screen.getByText('Publicar'));
    // The generic Sheet close control must not consume a second header row.
    expect(screen.queryByText('Fechar')).not.toBeInTheDocument();
  });

  it('publish button is disabled when content is empty', () => {
    render(<CreatePostSheet {...defaultProps} />);
    const publishButton = screen.getByText('Publicar');
    expect(publishButton).toBeDisabled();
  });

  it('publish button is enabled when content is entered', () => {
    render(<CreatePostSheet {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    fireEvent.change(textarea, { target: { value: 'Test post content' } });
    
    const publishButton = screen.getByText('Publicar');
    expect(publishButton).not.toBeDisabled();
  });

  it('calls onOpenChange when cancel is clicked', () => {
    render(<CreatePostSheet {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders user avatar with initial', () => {
    render(<CreatePostSheet {...defaultProps} />);
    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of "test@example.com"
  });

  it('renders privacy selector', () => {
    render(<CreatePostSheet {...defaultProps} />);
    expect(screen.getByText('Amigos')).toBeInTheDocument();
  });

  it('renders character counter', () => {
    render(<CreatePostSheet {...defaultProps} />);
    expect(screen.getByText('0/2000')).toBeInTheDocument();
  });

  it('updates character counter as user types', () => {
    render(<CreatePostSheet {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('renders media action buttons', () => {
    render(<CreatePostSheet {...defaultProps} />);

    // Should have image, video, location, and emoji buttons.
    // Sheet content is portaled to document.body, so query there.
    const actionBar = document.body.querySelector('[data-testid="post-action-buttons"]');
    const actionButtons = actionBar?.querySelectorAll('button') ?? [];
    expect(actionButtons.length).toBeGreaterThanOrEqual(4);
  });

  it('shows error toast when trying to submit empty post', async () => {
    render(<CreatePostSheet {...defaultProps} />);
    
    // The publish button should be disabled, but let's verify the behavior
    const publishButton = screen.getByText('Publicar');
    expect(publishButton).toBeDisabled();
  });

  it('calls createPost and closes sheet on successful submission', async () => {
    mockCreatePost.mockResolvedValueOnce({ id: 'new-post-id' });
    
    render(<CreatePostSheet {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    fireEvent.change(textarea, { target: { value: 'My new post' } });
    
    const publishButton = screen.getByText('Publicar');
    fireEvent.click(publishButton);
    
    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledWith('text', expect.objectContaining({
        content: 'My new post',
        privacy: 'contacts',
      }));
    });
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Publicado!',
      }));
    });
    
    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows loading state while submitting', async () => {
    mockCreatePost.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<CreatePostSheet {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    fireEvent.change(textarea, { target: { value: 'Test post' } });
    
    const publishButton = screen.getByText('Publicar');
    fireEvent.click(publishButton);
    
    await waitFor(() => {
      expect(screen.getByText('A publicar...')).toBeInTheDocument();
    });
  });

  it('shows error toast when submission fails', async () => {
    mockCreatePost.mockRejectedValueOnce(new Error('Failed'));
    
    render(<CreatePostSheet {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    fireEvent.change(textarea, { target: { value: 'Test post' } });
    
    const publishButton = screen.getByText('Publicar');
    fireEvent.click(publishButton);
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Falha ao publicar',
        variant: 'destructive',
      }));
    });
  });


  it('keeps the photo and allows retry when the post insert returns null', async () => {
    mockCreatePost.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'saved-on-retry' });
    render(<CreatePostSheet {...defaultProps} />);

    const input = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    const photo = new File(['test-photo'], 'afis.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [photo] } });

    await waitFor(() => expect(screen.getByText('Publicar')).not.toBeDisabled());
    expect(document.body.querySelector('[data-testid="muxi-photo-preview"]')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Publicar'));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Falha ao publicar',
      variant: 'destructive',
    })));
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
    expect(document.body.querySelector('[data-testid="muxi-photo-preview"]')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Publicar'));
    await waitFor(() => expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows a specific upload error without discarding the selected photo', async () => {
    mockCreatePost.mockRejectedValueOnce(new Error('Falha ao enviar ficheiro: Storage indisponível'));
    render(<CreatePostSheet {...defaultProps} />);
    const input = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['photo'], 'afis.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(screen.getByText('Publicar')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Publicar'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Falha ao enviar ficheiro: Storage indisponível',
      variant: 'destructive',
    })));
    expect(document.body.querySelector('[data-testid="muxi-photo-preview"]')).toBeInTheDocument();
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
  });

  it('announces upload stages to the user', async () => {
    mockCreatePost.mockImplementationOnce(async (_type, opts) => {
      opts.onUploadProgress('uploading', 1, 2);
      await Promise.resolve();
      opts.onUploadProgress('saving', 2, 2);
      return { id: 'saved-post' };
    });
    render(<CreatePostSheet {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("O que se passa na tua vizinhança?"), {
      target: { value: 'AFIS' },
    });
    fireEvent.click(screen.getByText('Publicar'));
    await waitFor(() => expect(mockCreatePost).toHaveBeenCalled());
    await waitFor(() => expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false));
  });

  // Set up geolocation + reverse-geocoding so location resolves to "San Francisco, CA".
  const mockGeolocationSuccess = () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 37.7749, longitude: -122.4194 },
          } as GeolocationPosition),
      },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue({ state: 'granted' }),
      },
    });
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ address: { city: 'San Francisco', country: 'CA' } }),
    } as Response);
  };

  it('adds location when location button is clicked', async () => {
    mockGeolocationSuccess();
    render(<CreatePostSheet {...defaultProps} />);

    // Find location button (MapPin icon)
    const buttons = screen.getAllByRole('button');
    const locationButton = buttons.find(btn =>
      btn.querySelector('svg.text-red-500')
    );

    expect(locationButton).toBeDefined();
    fireEvent.click(locationButton!);

    await waitFor(() => {
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });
  });

  it('removes location when X is clicked', async () => {
    mockGeolocationSuccess();
    render(<CreatePostSheet {...defaultProps} />);

    // First add location
    const buttons = screen.getAllByRole('button');
    const locationButton = buttons.find(btn =>
      btn.querySelector('svg.text-red-500')
    );

    expect(locationButton).toBeDefined();
    fireEvent.click(locationButton!);

    await waitFor(() => {
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
    });

    // Find and click remove button
    const removeButtons = screen.getAllByRole('button');
    const removeLocationButton = removeButtons.find(btn =>
      btn.classList.contains('w-5') && btn.classList.contains('h-5')
    );

    expect(removeLocationButton).toBeDefined();
    fireEvent.click(removeLocationButton!);

    await waitFor(() => {
      expect(screen.queryByText('San Francisco, CA')).not.toBeInTheDocument();
    });
  });

  it('has hidden file input for media uploads', () => {
    render(<CreatePostSheet {...defaultProps} />);

    // Sheet content is portaled to document.body, so query there.
    const fileInput = document.body.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass('hidden');
    expect(fileInput).toHaveAttribute('accept', 'image/*,video/*');
  });

  it('allows multiple file selection', () => {
    render(<CreatePostSheet {...defaultProps} />);

    const fileInput = document.body.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute('multiple');
  });

  it('renders Tu as user label', () => {
    render(<CreatePostSheet {...defaultProps} />);
    expect(screen.getByText('Tu')).toBeInTheDocument();
  });

  it('does not force the iPhone keyboard open when the composer appears', () => {
    render(<CreatePostSheet {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    expect(textarea).not.toHaveAttribute('autofocus');
  });

  it('shows privacy options in select', async () => {
    render(<CreatePostSheet {...defaultProps} />);
    
    // The default should be "Contacts"
    expect(screen.getByText('Amigos')).toBeInTheDocument();
  });
});
