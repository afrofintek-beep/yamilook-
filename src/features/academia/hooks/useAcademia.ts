import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { MentorCardProps } from '../components/MentorCard';

export interface AcademiaSession {
  id: string;
  title: string;
  description: string | null;
  mentorId: string;
  mentorName: string;
  mentorAvatar?: string;
  date: string;
  time: string;
  format: string;
  spots: number;
  spotsLeft: number;
  isPremium: boolean;
  priceCoins: number;
  status: string;
  scheduledAt: string;
  archivedAt?: string | null;
  cancellationReason?: string | null;
}

const QUERY_KEY = ['academia-sessions'];

export function useAcademiaSessions() {
  return useQuery({
    queryKey: QUERY_KEY,
    // Availability changes on other devices; override the app's five-minute cache.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_sessions')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      if (!data?.length) return [] as AcademiaSession[];

      // Get mentor names
      const mentorIds = [...new Set(data.map(s => s.mentor_id))];
      const profileMap: Record<string, { name: string; avatar?: string }> = {};

      if (mentorIds.length > 0) {
        const { data: profiles } = await supabase.rpc('get_public_profiles_by_ids', {
          p_ids: mentorIds,
        });
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.id] = {
              name: p.display_name || 'Anónimo',
              avatar: p.avatar_url ?? undefined,
            };
          }
        }
      }

      return data.map((s): AcademiaSession => {
        const dt = new Date(s.scheduled_at);
        return {
          id: s.id,
          title: s.title,
          description: s.description,
          mentorId: s.mentor_id,
          mentorName: profileMap[s.mentor_id]?.name ?? 'Anónimo',
          mentorAvatar: profileMap[s.mentor_id]?.avatar,
          date: format(dt, 'd MMM', { locale: pt }),
          time: format(dt, "HH:mm"),
          format: s.format,
          spots: s.spots,
          spotsLeft: s.spots_left,
          isPremium: (s.price_coins ?? 0) > 0,
          priceCoins: s.price_coins ?? 0,
          status: s.status,
          archivedAt: s.archived_at,
          cancellationReason: s.cancellation_reason,
          scheduledAt: s.scheduled_at,
        };
      });
    },
  });
}

export function useCreateAcademiaSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      format: string;
      spots: number;
      priceCoins: number;
      scheduledAt: string;
      durationMinutes?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('academia_sessions').insert({
        mentor_id: user.id,
        title: input.title,
        description: input.description || null,
        format: input.format,
        spots: input.spots,
        spots_left: input.spots,
        price_coins: input.priceCoins,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMinutes ?? 60,
        status: 'scheduled',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

const MENTORS_QUERY_KEY = ['academia-mentors'];

/**
 * Submit (or update) the current user's review for a session.
 * Upserts on the (session_id, reviewer_id) unique key so re-reviewing a
 * session overwrites the previous rating rather than erroring.
 */
export function useSubmitAcademiaReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      mentorId: string;
      rating: number;
      comment: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('academia_reviews')
        .upsert(
          {
            session_id: input.sessionId,
            mentor_id: input.mentorId,
            reviewer_id: user.id,
            rating: input.rating,
            comment: input.comment.trim() || null,
          },
          { onConflict: 'session_id,reviewer_id' },
        );

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      // Refresh the mentor's aggregate rating and any session views.
      queryClient.invalidateQueries({ queryKey: MENTORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['mentor-profile', variables.mentorId] });
      queryClient.invalidateQueries({ queryKey: ['academia-session', variables.sessionId] });
    },
  });
}

export function useAcademiaMentors() {
  return useQuery({
    queryKey: MENTORS_QUERY_KEY,
    queryFn: async (): Promise<MentorCardProps[]> => {
      const { data: mentorProfiles, error } = await supabase
        .from('mentor_profiles')
        .select('*');

      if (error) throw error;
      if (!mentorProfiles?.length) return [];

      const userIds = mentorProfiles.map((m) => m.user_id);

      const [{ data: profiles }, { data: reviews }, { data: sessions }] = await Promise.all([
        supabase.rpc('get_public_profiles_by_ids', { p_ids: userIds }),
        supabase.from('academia_reviews').select('mentor_id, rating').in('mentor_id', userIds),
        supabase.from('academia_sessions').select('mentor_id').in('mentor_id', userIds),
      ]);

      const profileMap: Record<string, { name: string; avatar?: string }> = {};
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = {
            name: p.display_name || 'Mentor',
            avatar: p.avatar_url ?? undefined,
          };
        }
      }

      const ratingAgg: Record<string, { sum: number; count: number }> = {};
      if (reviews) {
        for (const r of reviews) {
          const agg = ratingAgg[r.mentor_id] ?? { sum: 0, count: 0 };
          agg.sum += r.rating;
          agg.count += 1;
          ratingAgg[r.mentor_id] = agg;
        }
      }

      const sessionCounts: Record<string, number> = {};
      if (sessions) {
        for (const s of sessions) {
          sessionCounts[s.mentor_id] = (sessionCounts[s.mentor_id] ?? 0) + 1;
        }
      }

      return mentorProfiles.map((m): MentorCardProps => {
        const agg = ratingAgg[m.user_id];
        return {
          id: m.user_id,
          name: profileMap[m.user_id]?.name ?? 'Mentor',
          avatar: profileMap[m.user_id]?.avatar,
          specialty: m.specialty,
          rating: agg && agg.count > 0 ? agg.sum / agg.count : 0,
          sessionCount: sessionCounts[m.user_id] ?? 0,
          isVerified: m.is_verified_mentor,
        };
      });
    },
  });
}

const IS_MENTOR_QUERY_KEY = ['academia-is-mentor'];

export function useIsMentor() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...IS_MENTOR_QUERY_KEY, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
  });
}

export function useBecomeMentor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { specialty: string; mentorBio: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('mentor_profiles').insert({
        user_id: user.id,
        specialty: input.specialty,
        mentor_bio: input.mentorBio || null,
        is_verified_mentor: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MENTORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...IS_MENTOR_QUERY_KEY, user?.id] });
    },
  });
}

export function useManageAcademiaSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, action, reason }: { sessionId: string; action: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('academia_manage_session', {
        p_session: sessionId, p_action: action, p_reason: reason,
      });
      if (error) throw error;
      if (!(data as { ok?: boolean })?.ok) throw new Error('Não foi possível gerir a sessão.');
    },
    onSuccess: () => {
      for (const key of ['academia-sessions', 'academia-session', 'academia-reservation', 'academia-notices', 'kumbu-ledger']) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useAcademiaNotices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academia-notices', user?.id], enabled: !!user,
    staleTime: 30_000, refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('academia_my_notices');
      if (error) throw error;
      return data ?? [];
    },
  });
}
