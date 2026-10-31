import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const mentorStatus: Record<string, string> = {
  pending: 'Candidatura pendente', review_required: 'Em revisão', active: 'Activo',
  rejected: 'Candidatura rejeitada', suspended: 'Suspenso', inactive: 'Desactivado',
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
