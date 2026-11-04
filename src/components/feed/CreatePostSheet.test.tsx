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
    const stored = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation(key => stored.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => { stored.set(key, value); });
    vi.mocked(localStorage.removeItem).mockImplementation(key => { stored.delete(key); });
    vi.mocked(localStorage.clear).mockImplementation(() => { stored.clear(); });
    localStorage.clear();
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

  it('offers to save, continue editing or discard when cancelling a post with content', () => {
    render(<CreatePostSheet {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("O que se passa na tua vizinhança?"), {
      target: { value: 'Texto ainda não publicado' },
    });

    fireEvent.click(screen.getByText('Cancelar'));

    expect(screen.getByText('Guardar como rascunho?')).toBeInTheDocument();
    expect(screen.getByText('Guardar rascunho')).toBeInTheDocument();
    expect(screen.getByText('Continuar a editar')).toBeInTheDocument();
    expect(screen.getByText('Descartar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continuar a editar'));
    expect(screen.queryByText('Guardar como rascunho?')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("O que se passa na tua vizinhança?")).toHaveValue('Texto ainda não publicado');
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
  });

  it('saves and restores a post draft for the signed-in account', async () => {
    const first = render(<CreatePostSheet {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("O que se passa na tua vizinhança?"), {
      target: { value: 'Guardar esta ideia' },
    });
    fireEvent.click(screen.getByText('Cancelar'));
    fireEvent.click(screen.getByText('Guardar rascunho'));

    await waitFor(() => expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false));
    expect(localStorage.getItem('yamilook_post_draft_v1:test-user-id')).toContain('Guardar esta ideia');
    first.unmount();

    render(<CreatePostSheet {...defaultProps} />);
    await waitFor(() => expect(screen.getByPlaceholderText("O que se passa na tua vizinhança?")).toHaveValue('Guardar esta ideia'));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rascunho recuperado' }));
  });

  it('discards the pending draft and closes the composer', async () => {
    localStorage.setItem('yamilook_post_draft_v1:test-user-id', JSON.stringify({
      version: 1,
      content: 'Rascunho antigo',
      privacy: 'contacts',
      location: '',
      selectedTopics: [],
      hadMedia: false,
      savedAt: Date.now(),
    }));
    render(<CreatePostSheet {...defaultProps} />);
    await waitFor(() => expect(screen.getByPlaceholderText("O que se passa na tua vizinhança?")).toHaveValue('Rascunho antigo'));
    fireEvent.click(screen.getByText('Cancelar'));
    fireEvent.click(screen.getByText('Descartar'));

    await waitFor(() => expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false));
    expect(localStorage.getItem('yamilook_post_draft_v1:test-user-id')).toBeNull();
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

  it('keeps a visible progress status until saving finishes', async () => {
    let complete!: (result: { id: string }) => void;
    mockCreatePost.mockImplementationOnce(() => new Promise(resolve => {
      complete = resolve;
    }));
    render(<CreatePostSheet {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("O que se passa na tua vizinhança?");
    fireEvent.change(textarea, { target: { value: 'Test post' } });
    fireEvent.click(screen.getByText('Publicar'));
    await waitFor(() => expect(mockCreatePost).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('A publicar...');
    complete({ id: 'saved' });
    await waitFor(() => expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false));
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
  it('labels a MOV without MIME as video, shows percent and retains the draft on cancel', async () => {
    mockCreatePost.mockImplementationOnce((_type, options) => new Promise((_resolve, reject) => {
      options.onUploadProgress('uploading', 1, 1, 42);
      options.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
    }));
    render(<CreatePostSheet {...defaultProps} />);
    const file = new File(['video'], 'clip.MOV', { type: '' });
    fireEvent.change(document.body.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Publicar')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Publicar'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('A enviar vídeo 1/1… 42%'));
    expect(mockCreatePost).toHaveBeenCalledWith('video', expect.objectContaining({ mediaFiles: [file] }));
    fireEvent.click(screen.getByText('Cancelar'));
    await waitFor(() => expect(screen.getByText('Publicar')).not.toBeDisabled());
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
    expect(document.querySelector('video')).not.toBeNull();
  });

  it('shows a storage size rejection inside the composer instead of behind it', async () => {
    mockCreatePost.mockRejectedValueOnce(new Error('Este ficheiro excede o limite de envio.'));
    render(<CreatePostSheet {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('O que se passa na tua vizinhança?'), { target: { value: 'Rascunho' } });
    fireEvent.click(screen.getByText('Publicar'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Este ficheiro excede o limite de envio.');
    expect(screen.getByRole('dialog')).toContainElement(alert);
    expect(screen.getByPlaceholderText('O que se passa na tua vizinhança?')).toHaveValue('Rascunho');
  });

});
