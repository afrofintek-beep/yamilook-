import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { pilotPath } from './paths';
import type { PilotData } from './model';

const Pilot = lazy(() => import('./Pilot'));
const storageKey = 'dangereux-invitation';
const validKey = /^[a-f0-9]{64}$/;

function invitationKey() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('acesso')) {
    const key = fragment.get('acesso') || '';
    try {
      if (validKey.test(key)) sessionStorage.setItem(storageKey, key);
      else sessionStorage.removeItem(storageKey);
      history.replaceState(history.state, '', location.pathname + location.search);
    } catch { /* Keep the invitation in the fragment if session storage is unavailable. */ }
    return validKey.test(key) ? key : null;
  }
  try { return sessionStorage.getItem(storageKey); } catch { return null; }
}

export default function Access() {
  const [data, setData] = useState<PilotData | null>(null);
  const [status, setStatus] = useState('A verificar o acesso…');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let version = 0;
    let active = true;
    async function check() {
      const current = ++version;
      try {
        const { data: result, error } = await supabase.rpc('open_dangereux_pilot' as never, { p_key: invitationKey() } as never);
        if (!active || current !== version) return;
        if (error) throw error;
        const next = result as unknown as PilotData | null;
        setData(next && Array.isArray(next.places) ? next : null);
        setStatus('Entra com uma conta da Administração ou abre a ligação privada que recebeste.');
      } catch {
        if (!active || current !== version) return;
        setData(null);
        setStatus('Não foi possível verificar o acesso. Verifica a ligação e tenta novamente.');
      }
    }
    function hide() { ++version; setData(null); }
    function visibility() { if (document.hidden) hide(); else void check(); }
    function newLink() { if (location.hash.startsWith('#acesso=')) { hide(); void check(); } }
    // Defer the RPC until Supabase releases its auth-event lock.
    const {data: {subscription}} = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        hide();
        window.setTimeout(() => { if (active) void check(); }, 0);
      }
    });
    const timer = window.setInterval(() => { if (!document.hidden) void check(); }, 30000);
    void check();
    window.addEventListener('pageshow', check);
    window.addEventListener('pagehide', hide);
    window.addEventListener('offline', hide);
    window.addEventListener('hashchange', newLink);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false; subscription.unsubscribe(); clearInterval(timer);
      window.removeEventListener('pageshow', check); window.removeEventListener('pagehide', hide);
      window.removeEventListener('offline', hide); window.removeEventListener('hashchange', newLink);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [attempt]);

  if (data) return <Suspense fallback={<p>A abrir o bairro…</p>}><Pilot key={data.admin ? 'admin' : 'guest'} data={data}/></Suspense>;
  return <main lang="pt-AO" style={{maxWidth:460,margin:'12vh auto',padding:24,fontFamily:'system-ui',lineHeight:1.6}}>
    <small>Yamilook · Dangereux</small><h1>Acesso reservado</h1><p role="status">{status}</p>
    <a style={{textDecoration:'underline'}} href={'/login?next='+encodeURIComponent(pilotPath)}>Entrar como administrador</a>
    <button style={{marginLeft:16,padding:8}} onClick={()=>retry(n=>n+1)}>Tentar novamente</button>
  </main>;
}
