import { supabase } from '@/integrations/supabase/client';
export type ResidenceMethod = 'home' | 'away' | 'existing' | 'later';
export interface ResidencePlan { method: ResidenceMethod; code?: string; lat?: number; lng?: number; accuracy?: number }
export function validResidencePlan(plan: ResidencePlan) {
  if (plan.method === 'home') return Number.isFinite(plan.lat) && Number.isFinite(plan.lng) && !!plan.accuracy && plan.accuracy > 0 && plan.accuracy <= 1000;
  if (plan.method === 'existing') return /^[A-Z0-9]+(-[A-Z0-9]+){2,}$/.test(plan.code?.trim().toUpperCase() || '');
  return plan.method === 'away' || plan.method === 'later';
}
export async function submitResidence(plan: ResidencePlan, country: string, city: string, neighborhood: string) {
  if (!validResidencePlan(plan)) throw new Error('Confirma a opção de endereço antes de continuar.');
  // Non-home choices never send the current GPS or turn it into a residence.
  const { data, error } = await supabase.rpc('submit_residence_declaration' as never, {
    p_method: plan.method, p_country: country, p_city: city, p_neighborhood: neighborhood,
    p_code: plan.method === 'existing' ? plan.code?.trim().toUpperCase() : null,
    p_lat: plan.method === 'home' ? plan.lat : null, p_lng: plan.method === 'home' ? plan.lng : null,
    p_accuracy: plan.method === 'home' ? plan.accuracy : null,
  } as never);
  if (error) throw new Error(error.message.includes('cooldown') ? 'A mudança de Banda ainda está no período de espera.' : 'Não foi possível guardar a Banda. Tenta novamente.');
  return data;
}
