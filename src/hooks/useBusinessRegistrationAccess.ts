import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useBusinessRegistrationAccess(enabled = true) {
  const { user } = useAuth();
  const id = enabled ? user?.id : undefined;
  const [result, setResult] = useState<{ id: string; allowed: boolean }>();
  useEffect(() => {
    let active = true;
    if (id) {
      void (async () => {
        let allowed = false;
        try {
          const { data, error } = await supabase.rpc('has_business_registration_access');
          allowed = !error && data === true;
        } finally {
          if (active) setResult({ id, allowed });
        }
      })().catch(() => {});
    } else {
      setResult(undefined);
    }
    return () => { active = false; };
  }, [id]);
  return { data: !!id && result?.id === id && result.allowed, isLoading: !!id && result?.id !== id };
}
