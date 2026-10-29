import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
export type LearningGoal = Database['public']['Tables']['academia_goals']['Row'];
export type LearningChallenge = Database['public']['Tables']['academia_challenges']['Row'];
export type LearningSubmission = Database['public']['Tables']['academia_submissions']['Row'];
export const learningStatus: Record<string, string> = {
  requested: 'A aguardar o mentor', active: 'Em curso', completed: 'Concluído', cancelled: 'Encerrado',
  open: 'Por entregar', submitted: 'Em avaliação', revision: 'Rever e entregar novamente', approved: 'Validado', pending: 'Em avaliação',
};
export type CommunityAction = 'cohort_create' | 'cohort_join' | 'cohort_close' | 'work_publish' | 'work_hide';
export type LearningAction = CommunityAction | 'create' | 'plan' | 'challenge' | 'submit' | 'review' | 'complete' | 'cancel';
export interface LearningInput { action: LearningAction; goalId?: string; targetId?: string; payload?: Record<string, Json> }
export async function requestLearningAction(input: LearningInput): Promise<string> {
  const refresh = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) throw new Error('Inicia sessão novamente.');
    return data.session;
  };
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Inicia sessão novamente.');
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 10000) session = await refresh();
  const invoke = (token: string) => supabase.functions.invoke('academia-learning', { headers: { Authorization: `Bearer ${token}` }, body: input });
  let result = await invoke(session.access_token);
  if (result.error?.context?.status === 401) { session = await refresh(); result = await invoke(session.access_token); }
  if (result.error) {
    let message = 'Não foi possível guardar o percurso. Tenta novamente.';
    try { const body = await result.error.context?.json(); if (typeof body?.error === 'string') message = body.error; } catch { /* offline */ }
    throw new Error(message);
  }
  if (typeof result.data?.id !== 'string') throw new Error('Não foi possível confirmar a alteração. Atualiza o percurso.');
  return result.data.id;
}
async function namesFor(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, string>();
  const { data, error } = await supabase.rpc('get_public_profiles_by_ids', { p_ids: unique });
  if (error) throw error;
  return new Map((data || []).map(p => [p.id, p.display_name || 'Participante']));
}
export function useLearningGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academia-learning', user?.id, 'list'], enabled: !!user?.id, staleTime: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from('academia_goals').select('*')
        .or(`learner_id.eq.${user!.id},mentor_id.eq.${user!.id}`).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const goals = data || [];
      const [names, challengeResult] = await Promise.all([
        namesFor(goals.flatMap(g => [g.learner_id, g.mentor_id])),
        goals.length ? supabase.rpc('academia_learning_progress', { p_goals: goals.map(g => g.id) }) : Promise.resolve({ data: [], error: null }),
      ]);
      if (challengeResult.error) throw challengeResult.error;
      return goals.map(goal => {
        const progress = (challengeResult.data || []).find(c => c.goal_id === goal.id);
        return { ...goal, mentorName: names.get(goal.mentor_id) || 'Mentor', learnerName: names.get(goal.learner_id) || 'Aluno', total: Number(progress?.total || 0), approved: Number(progress?.approved || 0) };
      });
    },
  });
}
export function useLearningGoal(goalId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academia-learning', user?.id, goalId], enabled: !!user?.id && !!goalId, staleTime: 0,
    queryFn: async () => {
      const [goalResult, challengesResult] = await Promise.all([
        supabase.from('academia_goals').select('*').eq('id', goalId!).maybeSingle(),
        supabase.from('academia_challenges').select('*').eq('goal_id', goalId!).order('position'),
      ]);
      if (goalResult.error) throw goalResult.error;
      if (challengesResult.error) throw challengesResult.error;
      if (!goalResult.data) return null;
      const goal = goalResult.data, challenges = challengesResult.data || [];
      const [names, submissionsResult] = await Promise.all([
        namesFor([goal.learner_id, goal.mentor_id]),
        challenges.length ? supabase.from('academia_submissions').select('*').in('challenge_id', challenges.map(c => c.id)).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as LearningSubmission[], error: null }),
      ]);
      if (submissionsResult.error) throw submissionsResult.error;
      return { goal, challenges, submissions: submissionsResult.data || [], mentorName: names.get(goal.mentor_id) || 'Mentor', learnerName: names.get(goal.learner_id) || 'Aluno' };
    },
  });
}
export function useLearningAction() {
  const client = useQueryClient();
  const { user } = useAuth();
  return useMutation({ mutationFn: requestLearningAction,
    onSuccess: () => client.invalidateQueries({ queryKey: ['academia-learning', user?.id] }),
  });
}
