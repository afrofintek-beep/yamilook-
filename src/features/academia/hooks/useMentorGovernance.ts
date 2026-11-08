import { uiText } from '@/i18n/ui-copy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const mentorStatus: Record<string, string> = {
  get pending() { return uiText("Candidatura pendente"); }, get review_required() { return uiText("Em revisão"); }, get active() { return uiText("Activo"); },
  get rejected() { return uiText("Candidatura rejeitada"); }, get suspended() { return uiText("Suspenso"); }, get inactive() { return uiText("Desactivado"); },
};
export function useMyMentor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-mentor', user?.id], enabled: !!user, staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('mentor_profiles').select('*').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
export function useRefreshMentors() {
  const client = useQueryClient();
  return () => Promise.all(['my-mentor','admin-mentors','mentor-audit','academia-mentors','academia-is-mentor','mentor-profile'].map(key => client.invalidateQueries({ queryKey: [key] })));
}
