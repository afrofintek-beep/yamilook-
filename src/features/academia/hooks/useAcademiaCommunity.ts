import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';
import { requestLearningAction, type LearningInput } from './useAcademiaLearning';
type Tables = Database['public']['Tables'];
export type Community = Tables['academia_communities']['Row'];
export type Cohort = Tables['academia_cohorts']['Row'];
export type PublicWork = Tables['academia_public_works']['Row'];
export function useCommunities() {
  return useQuery({ queryKey: ['academia-community-catalog'], staleTime: 300000, queryFn: async () => {
    const { data, error } = await supabase.from('academia_communities').select('*').order('position');
    if (error) throw error; return data || [];
  } });
}
export function useCommunityCohorts(slug: string | undefined) {
  return useQuery({ queryKey: ['academia-communities', 'cohorts', slug], enabled: !!slug, staleTime: 15000, queryFn: async () => {
    const { data, error } = await supabase.from('academia_cohorts').select('*').eq('community_slug', slug!).order('created_at', { ascending: false }).limit(100);
    if (error) throw error; return data || [];
  } });
}
export function usePublicWorks(slug: string | undefined) {
  return useQuery({ queryKey: ['academia-communities', 'works', slug], enabled: !!slug, staleTime: 15000, queryFn: async () => {
    const { data, error } = await supabase.from('academia_public_works').select('*').eq('community_slug', slug!).eq('published', true).order('created_at', { ascending: false }).limit(30);
    if (error) throw error; return data || [];
  } });
}
export function usePublicWork(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['academia-communities', user?.id, 'work', id], enabled: !!id, staleTime: 0, queryFn: async () => {
    const { data, error } = await supabase.from('academia_public_works').select('*').eq('id', id!).eq('published', true).maybeSingle();
    if (error) throw error; return data;
  } });
}
export function useOwnWork(challengeId: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['academia-communities', user?.id, 'own-work', challengeId], enabled: !!user?.id, staleTime: 0, queryFn: async () => {
    const { data: source, error } = await supabase.from('academia_work_sources').select('work_id').eq('challenge_id', challengeId).eq('owner_id', user!.id).maybeSingle();
    if (error) throw error; if (!source) return null;
    const result = await supabase.from('academia_public_works').select('*').eq('id', source.work_id).maybeSingle();
    if (result.error) throw result.error; return result.data;
  } });
}
export function useCohortMembers(cohortId: string, mentor: boolean) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['academia-communities', user?.id, 'members', cohortId, mentor], enabled: !!user?.id, staleTime: 0, queryFn: async () => {
    let query = supabase.from('academia_cohort_members').select('*').eq('cohort_id', cohortId);
    if (!mentor) query = query.eq('learner_id', user!.id);
    const { data, error } = await query.order('created_at');
    if (error) throw error;
    const members = data || [];
    if (!members.length) return [];
    const [names, progress] = await Promise.all([
      supabase.rpc('get_public_profiles_by_ids', { p_ids: members.map(m => m.learner_id) }),
      supabase.rpc('academia_learning_progress', { p_goals: members.map(m => m.goal_id) }),
    ]);
    if (names.error) throw names.error; if (progress.error) throw progress.error;
    return members.map(m => ({ ...m, name: names.data?.find(p => p.id === m.learner_id)?.display_name || 'Participante', progress: progress.data?.find(p => p.goal_id === m.goal_id) }));
  } });
}
export function useCommunityAction() {
  const client = useQueryClient(); const { user } = useAuth();
  return useMutation({ mutationFn: (input: LearningInput) => requestLearningAction(input), onSuccess: () => Promise.all([
    client.invalidateQueries({ queryKey: ['academia-communities'] }),
    client.invalidateQueries({ queryKey: ['academia-learning', user?.id] }),
  ]) });
}

export function useCohort(id: string | undefined) {
  return useQuery({ queryKey: ['academia-communities', 'cohort', id], enabled: !!id, staleTime: 0, queryFn: async () => {
    const { data, error } = await supabase.from('academia_cohorts').select('*').eq('id', id!).maybeSingle();
    if (error) throw error; return data;
  } });
}
export function useGoalCommunity(goalId: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['academia-communities', user?.id, 'goal-community', goalId], enabled: !!user?.id, staleTime: 0, queryFn: async () => {
    const { data, error } = await supabase.from('academia_cohort_members').select('cohort_id').eq('goal_id',goalId).eq('learner_id',user!.id).maybeSingle();
    if (error) throw error; if (!data) return null;
    const result = await supabase.from('academia_cohorts').select('community_slug').eq('id',data.cohort_id).maybeSingle();
    if (result.error) throw result.error; return result.data?.community_slug || null;
  } });
}
