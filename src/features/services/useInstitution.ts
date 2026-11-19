import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useInstitution(id?: string) {
  return useQuery({
    queryKey: ['service-institution', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('service_institutions' as never)
        .select('profile_id').eq('profile_id', id!).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    retry: false,
  }).data === true;
}
