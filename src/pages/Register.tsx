import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { supabase } from '@/integrations/supabase/client';

import { ShareRegistrationInvite } from '@/components/ShareRegistrationInvite';

function InvitationEntry({ code, next }: { code: string; next: string }) {
  useUiLocale();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState('');
  const [shared, setShared] = useState(false);
  const [title, setTitle] = useState<string | null>();
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const key = 'yamilook-hold-' + code.toUpperCase();
        const ticket = sessionStorage.getItem(key);
        if (ticket && Date.parse(sessionStorage.getItem(key+'-until') || '') > Date.now()) {
          const held = await supabase.rpc('validate_mvp_access_code',{p_code:'HOLD:'+ticket});
          if (held.data && typeof held.data === 'object' && !Array.isArray(held.data) && held.data.valid && active) {
            setTitle(null);
            return;
          }
        }
        const { data, error } = await supabase.rpc('validate_mvp_access_code', { p_code: code });
        if (error) throw error;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.valid !== true) {
          if (active) setMessage(data && typeof data === 'object' && !Array.isArray(data) && typeof data.error === 'string' ? data.error : 'Este convite não é válido.');
          return;
        }
        const name = data && typeof data === 'object' && !Array.isArray(data) && data.valid === true && data.campaign_name;
        if (active) {
          const collective = !!data && typeof data === 'object' && !Array.isArray(data) && data.valid === true && data.multi_use === true;
          setShared(collective);
          if (collective) setRemaining(uiText('Vagas disponíveis: {{count}}', { count: Number(data.remaining) }));
          setTitle(typeof name === 'string' ? name : collective ? uiText('Convite para a Yamilook') : null);
        }
      } catch {
        if (active) setMessage('Não foi possível verificar o convite. Volta a tentar.');
      }
    };
    void check();
    return () => { active = false; };
  }, [code]);
  async function start() {
    setBusy(true);
    try {
      const key = 'yamilook-hold-' + code.toUpperCase();
      const ticket = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key,ticket);
      const { data, error } = await supabase.rpc('reserve_registration_place',{p_code:code,p_ticket:ticket});
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.valid) {
        setMessage(data && typeof data === 'object' && !Array.isArray(data) && typeof data.error === 'string' ? data.error : 'Convite indisponível.');
        return;
      }
      sessionStorage.setItem(key+'-until',String(data.expires_at));
      navigate(next,{replace:true});
    } catch { setMessage('Não foi possível reservar a vaga. Volta a tentar.'); }
    finally { setBusy(false); }
  }
  if (message) return <main className="mx-auto max-w-md p-6"><YamilookLogo/><p role="status">{message}</p><Button onClick={() => window.location.reload()}>Voltar a verificar</Button></main>;
  if (title === null) return <Navigate to={next} replace />;
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
    <YamilookLogo />
    {title === undefined ? <p role="status">{uiText('A carregar…')}</p> : <>
      <h1 className="break-words text-3xl font-semibold">{title}</h1>
      <p>{uiText('Recebeste um convite pessoal para te inscreveres na Yamilook.')}</p>
      {shared ? <><p role="status">O teu convite é válido. {remaining}</p><Button disabled={busy} onClick={start}>Começar inscrição</Button></> : <Button asChild><Link to={next} replace>{uiText('Aceitar convite e inscrever-me')}</Link></Button>}
      {shared && <ShareRegistrationInvite code={code} />}
    </>}
  </main>;
}

export default function Register() {
  const { search, hash } = useLocation();
  if (new URLSearchParams(hash.replace(/^#/, '')).has('trusted')) {
    return <Navigate to={'/convite-confianca' + search + hash} replace />;
  }
  const code = new URLSearchParams(search).get('ref') ?? '';
  const next = `/onboarding${search}`;
  const business = new URLSearchParams(search).get('next') === '/meus-negocios?abrir=1';
  return (business && /^[a-z0-9]{4,16}$/i.test(code)) || /^(?:[\da-f]{16}|[a-z0-9]{4}-[a-z0-9]{4})$/i.test(code) ? <InvitationEntry key={code} code={code} next={next} /> : <Navigate to={next} replace />;
}
