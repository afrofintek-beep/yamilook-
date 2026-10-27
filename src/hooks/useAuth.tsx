import { clearLegacyPrivateCache } from '@/lib/private-cache';
import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session, AuthError, Provider } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { recordDevice } from '@/lib/device';
import { registerCurrentSession, listLoginAlerts, acknowledgeLoginAlerts, isRevokedSessionError } from '@/lib/account-sessions';
import { toast as securityToast } from 'sonner';

interface Profile {
  id: string;
  referral_code?: string | null;
  referred_by?: string | null;
  phone_number: string | null;
  email: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  birthday: string | null;
  gender: 'male' | 'female' | 'other' | null;
  country_code: string | null;
  city: string | null;
  neighborhood: string | null;
  status_message: string | null;
  is_online: boolean;
  onboarding_completed: boolean;
  app_tour_completed: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  show_read_receipts: boolean;
  show_typing_indicators: boolean;
  two_factor_enabled: boolean;
  kumbu_available: number;
  kumbu_lifetime: number;
  level: string;
  afroloc_code: string | null;
  afroloc_certification_status: 'none' | 'pending' | 'certified' | 'rejected';
  afroloc_certified_at: string | null;
  afroloc_certified_by: string | null;
  created_at: string;
  updated_at: string;
}

type SocialProvider = 'google' | 'apple' | 'facebook';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: boolean;
  signUp: (email: string, password: string, metadata?: { display_name?: string; username?: string; ref?: string; access_code?: string }) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithSocial: (provider: SocialProvider) => Promise<{ error: AuthError | null }>;
  signOut: (scope?: 'global' | 'local') => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  /** Optimistically patch the in-memory profile without a DB write. Use for
   *  instant UI feedback; reconcile with refreshProfile()/realtime after. */
  patchProfile: (patch: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const initialSessionResolved = useRef(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching profile', 'auth', error);
      throw error;
    }

    return data as Profile | null;
  };

  const refreshProfile = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    setProfileError(false);
    setLoading(true);
    try {
      const profileData = await fetchProfile(currentUser.id);
      if (userRef.current?.id !== currentUser.id) return;
      if (profileData) setProfile(profileData);
      setProfileError(!profileData);
    } catch (error) {
      logger.warn('Retrying profile failed', 'auth', error);
      if (userRef.current?.id === currentUser.id) setProfileError(true);
    } finally {
      if (userRef.current?.id === currentUser.id) setLoading(false);
    }
  }, []);

  const patchProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const userRef = useRef<User | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Realtime: re-fetch profile when onboarding_completed (or any row field) changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as Profile | undefined;
          const oldRow = payload.old as Partial<Profile> | undefined;
          if (
            newRow &&
            oldRow &&
            newRow.onboarding_completed !== oldRow.onboarding_completed
          ) {
            logger.info('onboarding_completed changed, refreshing profile', 'auth', {
              from: oldRow.onboarding_completed,
              to: newRow.onboarding_completed,
            });
            refreshProfile();
          } else if (newRow) {
            // Keep context in sync with any profile change
            setProfile((prev) => (prev ? { ...prev, ...newRow } : newRow));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshProfile]);

  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let disposed = false;
    let profileRequest = 0;

    // Only a change of account starts a fresh profile read. Refresh events for
    // the same account must not reset the screen or race with a pending fetch.
    const applySession = (nextSession: Session | null) => {
      const previousUserId = sessionRef.current?.user.id;
      const nextUserId = nextSession?.user.id;
      sessionRef.current = nextSession;
      userRef.current = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextUserId) {
        ++profileRequest;
        setProfile(null);
        setProfileError(false);
        setLoading(false);
        return;
      }

      if (previousUserId === nextUserId) return;

      const request = ++profileRequest;
      setProfile(null);
      setProfileError(false);
      setLoading(true);
      void fetchProfile(nextUserId)
        .then((profileData) => {
          if (disposed || request !== profileRequest) return;
          setProfile(profileData);
          setProfileError(!profileData);
        })
        .catch((error) => {
          if (disposed || request !== profileRequest) return;
          logger.warn('Profile unavailable after authentication', 'auth', error);
          setProfileError(true);
        })
        .finally(() => {
          if (!disposed && request === profileRequest) setLoading(false);
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (disposed) return;
        // Do not let the initial getSession() result overwrite a later sign-in
        // or sign-out from another tab or a recovered session.
        initialSessionResolved.current = true;
        applySession(nextSession);

        if (nextSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          // No nested Supabase calls inside its auth lock.
          window.setTimeout(() => {
            if (disposed || sessionRef.current?.user.id !== nextSession.user.id) return;
            void recordDevice(nextSession.user.id);
            void registerCurrentSession(navigator.userAgent, window.location.pathname)
              .catch(err => logger.warn('Account device registration unavailable', 'auth', err));
          }, 0);
        }
      }
    );

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (disposed || initialSessionResolved.current) return;
        initialSessionResolved.current = true;
        if (error) logger.warn('Stored authentication session could not be restored', 'auth', error);
        applySession(data.session ?? null);
      })
      .catch((error) => {
        if (disposed || initialSessionResolved.current) return;
        initialSessionResolved.current = true;
        logger.warn('Authentication initialization failed', 'auth', error);
        // Leave protected routes for a safe sign-in instead of an infinite loader.
        applySession(null);
      });

    return () => {
      disposed = true;
      ++profileRequest;
      subscription.unsubscribe();
    };
  }, []);

  // Notify all previously logged-in sessions of unfamiliar/new account access.
  // A database-owned event prevents the client from forging another user's alerts.
  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    let pending = false;
    const check = async () => {
      if (disposed || pending || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      pending = true;
      try {
        const entries = await listLoginAlerts();
        const unread = entries.filter(event => event.unread).slice(0, 10);
        if (disposed || !unread.length) return;
        for (const event of unread) {
          securityToast.warning('Novo acesso à sua conta', {
            description: `${event.device_label} · ${event.app_surface === 'kosolola' ? 'KOSOLOLA' : 'YAMILOOK'}`,
            duration: 12000,
          });
        }
        await acknowledgeLoginAlerts(unread.map(event => event.id));
      } catch {
        // Offline or not migrated yet; retry without disrupting signed-in users.
      } finally { pending = false; }
    };
    void check();
    const timer = window.setInterval(() => void check(), 45000);
    document.addEventListener('visibilitychange', check);
    return () => { disposed = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [user?.id]);

  // Lightweight heartbeat: the displayed last activity is real for open apps,
  // and sessions which have gone offline stop updating their timestamp.
  useEffect(() => {
    if (!user?.id) return;
    let running = false;
    const heartbeat = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try { await registerCurrentSession(navigator.userAgent, window.location.pathname); }
      catch { /* Backend migration or offline: retry on next activity. */ }
      finally { running = false; }
    };
    const timer = window.setInterval(() => void heartbeat(), 5 * 60 * 1000);
    window.addEventListener('focus', heartbeat);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', heartbeat); };
  }, [user?.id]);

  // Remote revocation is checked when the application resumes and periodically
  // while active. A 401/403 from Auth means the server no longer recognizes it.
  useEffect(() => {
    if (!user?.id) return;
    let pending = false;
    let disposed = false;
    const validate = async () => {
      if (disposed || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        // getUser() can accept a still-valid JWT after its database session
        // was revoked. This RPC checks session_id against auth.sessions itself.
        const client = supabase as unknown as {
          rpc: (name: string) => Promise<{ error: { code?: string; status?: number } | null }>;
        };
        const { error } = await client.rpc('account_current_session_id');
        if (!disposed && isRevokedSessionError(error)) {
          await signOut('local');
        }
      } catch { /* Network errors are not evidence of revoked access. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(() => void validate(), 90000);
    window.addEventListener('focus', validate);
    document.addEventListener('visibilitychange', validate);
    return () => {
      disposed = true; window.clearInterval(timer);
      window.removeEventListener('focus', validate);
      document.removeEventListener('visibilitychange', validate);
    };
  }, [user?.id]);

  const signUp = async (
    email: string,
    password: string,
    metadata?: { display_name?: string; username?: string; ref?: string; access_code?: string }
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: metadata,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });


    return { error };
  };

  const signInWithSocial = async (provider: SocialProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: `${window.location.origin}/feed`,
      },
    });
    return { error };
  };

  const signOut = async (scope: 'global' | 'local' = 'local') => {
    if (window.location.pathname.startsWith('/papos-app')) {
      const { disableCallPush } = await import('@/lib/call-push');
      await disableCallPush();
    }
    await clearLegacyPrivateCache();
    const { error } = await supabase.auth.signOut({ scope });
    
    const msg = (error?.message || '').toLowerCase();
    const isExpectedLogoutError =
      msg.includes('session not found') ||
      msg.includes('invalid refresh token') ||
      msg.includes('refresh token not found') ||
      msg.includes('refresh_token_not_found');

    if (error && !isExpectedLogoutError) {
      throw error;
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      await refreshProfile();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const value = {
    user,
    session,
    profile,
    loading,
    profileError,
    signUp,
    signInWithSocial,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
    patchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
