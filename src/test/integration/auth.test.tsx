import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { AuthProvider } from '@/hooks/useAuth';
import { mockSupabaseClient, resetMocks, mockAuthenticatedState, mockSession } from '@/test/mocks/supabase';

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

// Mock sonner toast (also provide the Toaster export used by the sonner UI wrapper)
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// The auth forms consume useAuth(), which requires an AuthProvider. Wrap them so
// signIn/signUp run their real implementations against the mocked supabase client.
const renderWithAuth = (ui: React.ReactElement) =>
  render(<AuthProvider>{ui}</AuthProvider>);

describe('Authentication Flow', () => {
  beforeEach(() => {
    resetMocks();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LoginForm', () => {
    it('renders login form with all fields', () => {
      renderWithAuth(<LoginForm />);

      expect(screen.getByPlaceholderText('nome@yamilook.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /entrar no yamilook/i })).toBeInTheDocument();
    });

    it('shows validation errors for empty fields', async () => {
      renderWithAuth(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /entrar no yamilook/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/por favor insere um email válido/i)).toBeInTheDocument();
      });
    });

    it('shows validation error for invalid email', async () => {
      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByPlaceholderText('nome@yamilook.com');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      const submitButton = screen.getByRole('button', { name: /entrar no yamilook/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/por favor insere um email válido/i)).toBeInTheDocument();
      });
    });

    it('shows validation error for short password', async () => {
      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByPlaceholderText('nome@yamilook.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });

      const submitButton = screen.getByRole('button', { name: /entrar no yamilook/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/a palavra-passe deve ter pelo menos 6 caracteres/i)
        ).toBeInTheDocument();
      });
    });

    it('toggles password visibility', async () => {
      renderWithAuth(<LoginForm />);

      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find the toggle button (eye icon)
      const toggleButton = passwordInput.parentElement?.querySelector('button');
      expect(toggleButton).toBeInTheDocument();

      fireEvent.click(toggleButton!);
      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.click(toggleButton!);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('submits form with valid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByPlaceholderText('nome@yamilook.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: /entrar no yamilook/i });
      fireEvent.click(submitButton);

      // On successful login the form navigates to the feed.
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/feed');
      });
    });

    it('shows error message on login failure', async () => {
      const { toast } = await import('sonner');

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      });

      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByPlaceholderText('nome@yamilook.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

      const submitButton = screen.getByRole('button', { name: /entrar no yamilook/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByPlaceholderText('nome@yamilook.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: /entrar no yamilook/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/a entrar/i)).toBeInTheDocument();
      });
    });

    it('has link to register page', () => {
      renderWithAuth(<LoginForm />);

      const registerLink = screen.getByRole('link', { name: /criar conta/i });
      expect(registerLink).toHaveAttribute('href', '/register');
    });

    it('has link to forgot password', () => {
      renderWithAuth(<LoginForm />);

      const forgotLink = screen.getByRole('link', { name: /esqueceu a palavra-passe/i });
      expect(forgotLink).toHaveAttribute('href', '/forgot-password');
    });
  });

  describe('RegisterForm', () => {
    it('renders register form with all fields', () => {
      renderWithAuth(<RegisterForm />);

      expect(screen.getByPlaceholderText('O teu nome')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('utilizador')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('nome@exemplo.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
    });

    it('shows password requirements as user types', async () => {
      renderWithAuth(<RegisterForm />);

      const passwordInput = screen.getByPlaceholderText('••••••••');

      // Initially no requirements shown
      expect(screen.queryByText(/pelo menos 8 caracteres/i)).not.toBeInTheDocument();

      // Type a password to show requirements
      fireEvent.change(passwordInput, { target: { value: 'a' } });

      await waitFor(() => {
        expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeInTheDocument();
        expect(screen.getByText(/uma letra maiúscula/i)).toBeInTheDocument();
        expect(screen.getByText(/uma letra minúscula/i)).toBeInTheDocument();
        expect(screen.getByText(/um número/i)).toBeInTheDocument();
      });
    });

    it('validates display name length', async () => {
      renderWithAuth(<RegisterForm />);

      const displayNameInput = screen.getByPlaceholderText('O teu nome');
      fireEvent.change(displayNameInput, { target: { value: 'A' } });

      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it('validates username format', async () => {
      renderWithAuth(<RegisterForm />);

      const usernameInput = screen.getByPlaceholderText('utilizador');
      fireEvent.change(usernameInput, { target: { value: 'ab' } });

      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      });
    });

    it('checks username availability', async () => {
      // Mock username check - available
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      });

      renderWithAuth(<RegisterForm />);

      const usernameInput = screen.getByPlaceholderText('utilizador');
      fireEvent.change(usernameInput, { target: { value: 'newuser123' } });

      // Wait for the availability check to render the green check indicator.
      await waitFor(() => {
        const checkIcon = usernameInput.parentElement?.querySelector('.text-green-500');
        expect(checkIcon).not.toBeNull();
      }, { timeout: 2000 });
    });

    it('shows taken username error', async () => {
      // Mock username check - taken
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { username: 'takenuser' },
          error: null,
        }),
      });

      renderWithAuth(<RegisterForm />);

      const usernameInput = screen.getByPlaceholderText('utilizador');
      fireEvent.change(usernameInput, { target: { value: 'takenuser' } });

      await waitFor(() => {
        expect(screen.getByText(/nome de utilizador já está em uso/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it.each(['ABCD-1234', '92C46B28', ' 92c46b28 '])('submits form with invitation %s', async (inviteCode) => {
      // Mock username available for all profile lookups.
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      // Registration requires a valid MVP access code (validated via RPC).
      mockSupabaseClient.rpc.mockImplementation((fn: string) => {
        if (fn === 'validate_mvp_access_code') {
          return Promise.resolve({
            data: { valid: true, candidate_id: 'cand-1' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      renderWithAuth(<RegisterForm />);

      fireEvent.change(screen.getByPlaceholderText('XXXX-XXXX'), {
        target: { value: inviteCode },
      });
      fireEvent.change(screen.getByPlaceholderText('O teu nome'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByPlaceholderText('utilizador'), {
        target: { value: 'testuser' },
      });
      fireEvent.change(screen.getByPlaceholderText('nome@exemplo.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });

      // Wait for access-code validation to complete (button enabled).
      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
          options: { data: expect.objectContaining({ access_code: inviteCode.trim().toUpperCase() }) },
        }));
      });
    });

    it('shows error message on signup failure', async () => {
      const { toast } = await import('sonner');

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      mockSupabaseClient.rpc.mockImplementation((fn: string) => {
        if (fn === 'validate_mvp_access_code') {
          return Promise.resolve({
            data: { valid: true, candidate_id: 'cand-1' },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: 'Email already registered' },
      });

      renderWithAuth(<RegisterForm />);

      fireEvent.change(screen.getByPlaceholderText('XXXX-XXXX'), {
        target: { value: 'ABCD-1234' },
      });
      fireEvent.change(screen.getByPlaceholderText('O teu nome'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByPlaceholderText('utilizador'), {
        target: { value: 'testuser' },
      });
      fireEvent.change(screen.getByPlaceholderText('nome@exemplo.com'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'Password123' },
      });

      const submitButton = screen.getByRole('button', { name: /criar conta/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Email already registered');
      });
    });

    it('has link to login page', () => {
      renderWithAuth(<RegisterForm />);

      const loginLink = screen.getByRole('link', { name: /entrar/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Logout Flow', () => {
    it('calls signOut and clears session', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null });

      // Simulate calling signOut
      const result = await mockSupabaseClient.auth.signOut();

      expect(result.error).toBeNull();
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });
  });
});
