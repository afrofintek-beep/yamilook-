import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AFROLOC_ORIGIN, AFROLOC_EXPERIENCE_URL, parseExperienceRequest } from './protocol';
/** The child receives operation results only, never passwords or session credentials. */
export default function AfrolocExperience() {
 const { user, profile } = useAuth();
 const frame = useRef<HTMLIFrameElement>(null);
 useEffect(() => {
  if (!user || profile?.country_code?.trim().toUpperCase() !== 'AO') return;
  let active = true;
  const pending = new Set<string>();
  const receive = async (event: MessageEvent) => {
   if (event.origin !== AFROLOC_ORIGIN || event.source !== frame.current?.contentWindow) return;
   const request = parseExperienceRequest(event.data);
   if (!request || pending.has(request.id) || pending.size >= 8) return;
   pending.add(request.id);
   try {
    const { data, error } = await supabase.functions.invoke('afroloc-experience', { body: { action: request.action, data: request.data } });
    if (active) frame.current?.contentWindow?.postMessage({ type: 'yamilook-afroloc-response', id: request.id, ...(error ? { error: 'Não foi possível concluir. Verifique a sessão e tente novamente.' } : data?.error ? {error:data.error} : { data }) }, AFROLOC_ORIGIN);
   } catch {
    if (active) frame.current?.contentWindow?.postMessage({type:'yamilook-afroloc-response',id:request.id,error:'Serviço indisponível. Tente novamente.'}, AFROLOC_ORIGIN);
   } finally { pending.delete(request.id); }
  };
  window.addEventListener('message', receive);
  return () => { active = false; window.removeEventListener('message', receive); pending.clear(); };
 }, [user?.id, profile?.country_code]);
 if (!user) return null;
 if (profile?.country_code?.trim().toUpperCase() !== 'AO') return <main className="p-6"><Link to="/settings">Voltar à Yamilook</Link><p>Esta experiência está disponível para contas com Angola seleccionado como país.</p></main>;
 return <main className="min-h-screen"><div className="p-3"><Link to="/settings">← Voltar à Yamilook</Link></div><iframe key={user.id} ref={frame} title="O meu endereço AFROLOC" src={AFROLOC_EXPERIENCE_URL} className="w-full min-h-[90vh] border-0" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" allow="geolocation https://app.afroloc.ao" /></main>;
}
