import {uiText,useUiLocale} from '@/i18n/ui-copy';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AFROLOC_ORIGIN, AFROLOC_EXPERIENCE_URL, parseExperienceRequest } from './protocol';
/** The child receives operation results only, never passwords or session credentials. */
export default function AfrolocExperience() {
 const locale=useUiLocale();
 const navigate=useNavigate();
 const requestedMap=useLocation().state?.afrolocMapAddressId;
 const { user, profile } = useAuth();
 const frame = useRef<HTMLIFrameElement>(null);
 useEffect(() => {
  if (!user || profile?.country_code?.trim().toUpperCase() !== 'AO') return;
  let active = true, mapOpened=false;
  const pending = new Set<string>();
  const receive = async (event: MessageEvent) => {
   if (event.origin !== AFROLOC_ORIGIN || event.source !== frame.current?.contentWindow) return;
   const request = parseExperienceRequest(event.data);
   if (!request || pending.has(request.id) || pending.size >= 8) return;
   if (request.action === 'open-card') {
    frame.current?.contentWindow?.postMessage({type:'yamilook-afroloc-response',id:request.id,data:{ok:true}},AFROLOC_ORIGIN);
    navigate('/afroloc/cartao',{state:{afrolocAddressId:request.data.id}});
    return;
   }
   pending.add(request.id);
   try {
    const { data, error } = await supabase.functions.invoke('afroloc-experience', { body: { action: request.action, data: request.data } });
    if (active) frame.current?.contentWindow?.postMessage({ type: 'yamilook-afroloc-response', id: request.id, ...(error ? { error: 'Não foi possível concluir. Verifique a sessão e tente novamente.' } : data?.error ? {error:data.error} : { data }) }, AFROLOC_ORIGIN);
    if(active&&!error&&!mapOpened&&request.action==='list'&&typeof requestedMap==='string'&&Array.isArray(data?.addresses)&&data.addresses.some((a:{id:string})=>a.id===requestedMap)){
     mapOpened=true;frame.current?.contentWindow?.postMessage({type:'yamilook-afroloc-navigation',action:'map',id:requestedMap},AFROLOC_ORIGIN);
    }
   } catch {
    if (active) frame.current?.contentWindow?.postMessage({type:'yamilook-afroloc-response',id:request.id,error:'Serviço indisponível. Tente novamente.'}, AFROLOC_ORIGIN);
   } finally { pending.delete(request.id); }
  };
  window.addEventListener('message', receive);
  return () => { active = false; window.removeEventListener('message', receive); pending.clear(); };
 }, [user?.id, profile?.country_code, navigate, requestedMap]);
 if (!user) return null;
 if (profile?.country_code?.trim().toUpperCase() !== 'AO') return <main className="p-6"><Link to="/settings">Voltar à Yamilook</Link><p>Esta experiência está disponível para contas com Angola seleccionado como país.</p></main>;
 return <main style={{height:"100dvh",display:"flex",flexDirection:"column",overflow:"hidden"}}><nav className="p-3" style={{display:"flex",gap:12,flexWrap:"wrap",flexShrink:0,fontSize:14,paddingTop:"max(12px, env(safe-area-inset-top))"}}><Link to="/afroloc/cartao">← {uiText("O meu cartão AFROLOC")}</Link><Link to="/settings">{uiText("Voltar à Yamilook")}</Link></nav><iframe key={user.id} ref={frame} title="O meu endereço AFROLOC" src={AFROLOC_EXPERIENCE_URL+'?lang='+encodeURIComponent(locale)} style={{width:"100%",flex:1,minHeight:0,border:0}} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" allow="geolocation https://app.afroloc.ao https://www.njilamaps.com; camera https://app.afroloc.ao https://www.njilamaps.com; accelerometer https://app.afroloc.ao https://www.njilamaps.com; gyroscope https://app.afroloc.ao https://www.njilamaps.com" /></main>;
}
