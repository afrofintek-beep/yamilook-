import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import type { BusinessProfile } from '@/hooks/useAdvertising';

import { businessCopy } from '@/lib/business-entry';
import { useTranslation } from 'react-i18next';

type Card = Pick<BusinessProfile, 'business_name' | 'handle' | 'description' | 'logo_url' | 'afroloc_code' | 'service_area' | 'service_modes'>;

export default function PublicBusiness() {
  useUiLocale();
  const { i18n } = useTranslation();
  const labels = businessCopy(i18n.language);
  const { handle } = useParams();
  const [card, setCard] = useState<Card | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setCard(null);
    setStatus('…');
    supabase.from('business_profiles').select('business_name,handle,description,logo_url,afroloc_code,service_area,service_modes')
      .eq('handle', (handle || '').replace(/^@/, '').toLowerCase()).eq('is_active', true).maybeSingle()
      .then(({data,error}) => {
        if (!active) return;
        setCard(data);
        setStatus(error ? uiText('Não foi possível carregar o negócio.') : uiText('Negócio não encontrado.'));
      });
    return () => { active = false; };
  }, [handle]);
  return <main className="mx-auto max-w-md space-y-4 px-5 py-8">
    {card ? <>
      {card.logo_url && <img src={card.logo_url} alt="" className="size-24 rounded-xl object-contain" />}
      <h1 className="text-2xl font-semibold">{card.business_name}</h1>
      <p>@{card.handle}</p><p>{card.description}</p>
      <p>{card.service_modes?.map(mode => labels[mode as 'shop'|'home'|'delivery'|'online']).join(' · ')}</p>
      {card.afroloc_code && <p>AFROLOC · {card.afroloc_code}</p>}
      {card.service_area && <p>{uiText('Zona de atendimento')} · {card.service_area}</p>}
    </> : <p role="status">{status}</p>}
  </main>;
}
