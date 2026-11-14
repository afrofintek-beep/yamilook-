import { validAdministrativeAddress, catalogVersion, type AdministrativeAddress } from './angola-administrative';
import { uiText } from '@/i18n/ui-copy';
import { supabase } from '@/integrations/supabase/client';
export type ResidenceMethod = 'home' | 'away' | 'existing' | 'later';
export interface ResidencePlan { method: ResidenceMethod; code?: string; lat?: number; lng?: number; accuracy?: number; administrative?: AdministrativeAddress }
export function validResidencePlan(plan: ResidencePlan) {
  if (plan.method === 'home') return Number.isFinite(plan.lat) && Number.isFinite(plan.lng) && !!plan.accuracy && plan.accuracy > 0 && plan.accuracy <= 1000;
  if (plan.method === 'existing') return /^[A-Z0-9]+(-[A-Z0-9]+){2,}$/.test(plan.code?.trim().toUpperCase() || '');
  return plan.method === 'away' || plan.method === 'later';
}
export async function submitResidence(plan: ResidencePlan, country: string, city: string, neighborhood: string) {
  if (country==='AO' && plan.administrative && !validAdministrativeAddress(plan.administrative)) throw new Error(uiText('Selecciona a província, o município e a comuna, quando exista.'));
  if (!validResidencePlan(plan)) throw new Error(uiText("Confirma a opção de endereço antes de continuar."));
  // Non-home choices never send the current GPS or turn it into a residence.
  const { data, error } = await supabase.rpc((country==='AO' && plan.administrative ? 'submit_residence_administrative' : 'submit_residence_declaration') as never, {
    ...(country==='AO' && plan.administrative ? {p_province:plan.administrative.province,p_municipality:plan.administrative.municipality,p_commune:plan.administrative.commune||null,p_complement:plan.administrative.complement||null,p_catalog_version:catalogVersion} : {}),
    p_method: plan.method, p_country: country, p_city: city, p_neighborhood: neighborhood,
    p_code: plan.method === 'existing' ? plan.code?.trim().toUpperCase() : null,
    p_lat: plan.method === 'home' ? plan.lat : null, p_lng: plan.method === 'home' ? plan.lng : null,
    p_accuracy: plan.method === 'home' ? plan.accuracy : null,
  } as never);
  if (error?.message.includes('address_administrative_mismatch')) throw new Error(uiText('O código AFROLOC não corresponde à divisão administrativa escolhida. Confirma os dados.'));
  if (error) throw new Error(error.message.includes('cooldown') ? uiText('A mudança de Banda ainda está no período de espera.') : uiText('Não foi possível guardar a Banda. Tenta novamente.'));
  return data;
}
