import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { mockSupabaseClient, resetMocks, mockSession, mockAuthUser, mockProfile } from '@/test/mocks/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ReactNode } from 'react';

// Mock the supabase client.
// The factory is hoisted above imports, so it cannot reference the top-level
// `mockSupabaseClient` binding. Use an async factory with a dynamic import
// (which resolves to the same singleton module instance the test imports).
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabaseClient } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabaseClient };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('initializes with loading state', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    // Initial loading state
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns null user when not authenticated', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('returns user data when authenticated', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: mockProfile, error: null }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockAuthUser);
    expect(result.current.session).toEqual(mockSession);
  });

  it('keeps an incomplete profile pending instead of automatically completing it', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({ data: { session: mockSession }, error: null });
    const update = vi.fn().mockReturnThis();
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update,
      single: vi.fn().mockResolvedValue({ data: { ...mockProfile, onboarding_completed: false, app_tour_completed: false }, error: null }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    expect(result.current.profile?.onboarding_completed).toBe(false);
    expect(result.current.profile?.app_tour_completed).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('signUp creates new user', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: { user: mockAuthUser, session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      signUpResult = await result.current.signUp(
        'newuser@test.com',
        'Password123!',
        { display_name: 'New User', username: 'newuser' }
      );
    });

    expect(signUpResult.error).toBeNull();
    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: 'newuser@test.com',
      password: 'Password123!',
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: 'New User', username: 'newuser' },
      },
    });
  });

  it('signUp returns error on failure', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const mockError = { message: 'Email already in use' };
    mockSupabaseClient.auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: mockError,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      signUpResult = await result.current.signUp('existing@test.com', 'Password123!');
    });

    expect(signUpResult.error).toEqual(mockError);
  });

  it('signIn authenticates user', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: mockAuthUser, session: mockSession },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await act(async () => {
      signInResult = await result.current.signIn('test@test.com', 'password123');
    });

    expect(signInResult.error).toBeNull();
    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123',
    });
  });

  it('signIn returns error on failure', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const mockError = { message: 'Invalid login credentials' };
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: mockError,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await act(async () => {
      signInResult = await result.current.signIn('test@test.com', 'wrongpassword');
    });

    expect(signInResult.error).toEqual(mockError);
  });

  it('signOut clears user data', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockSupabaseClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: mockProfile, error: null }),
    });

    mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('signInWithSocial initiates OAuth flow', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    mockSupabaseClient.auth.signInWithOAuth = vi.fn().mockResolvedValueOnce({
      data: { url: 'https://accounts.google.com/oauth' },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let socialResult: Awaited<ReturnType<typeof result.current.signInWithSocial>>;
    await act(async () => {
      socialResult = await result.current.signInWithSocial('google');
    });

    expect(socialResult.error).toBeNull();
    expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/feed`,
      },
    });
  });

  it('updateProfile updates user profile', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      update: vi.fn().mockReturnThis(),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updates = { display_name: 'Updated Name', bio: 'New bio' };

    await act(async () => {
      await result.current.updateProfile(updates);
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
  });

  it('throws error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    
    consoleSpy.mockRestore();
  });
});
