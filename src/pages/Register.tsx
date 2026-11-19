import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { supabase } from '@/integrations/supabase/client';

import { ShareRegistrationInvite } from '@/components/ShareRegistrationInvite';

function InvitationEntry({ code, next }: { code: string; next: string }) {
  useUiLocale();
  const [shared, setShared] = useState(false);
  const [title, setTitle] = useState<string | null>();
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data } = await supabase.rpc('validate_mvp_access_code', { p_code: code });
        const name = data && typeof data === 'object' && !Array.isArray(data) && data.valid === true && data.campaign_name;
        if (active) {
          const collective = !!data && typeof data === 'object' && !Array.isArray(data) && data.valid === true && data.multi_use === true;
          setShared(collective);
          setTitle(typeof name === 'string' ? name : collective ? uiText('Convite para a Yamilook') : null);
        }
      } catch {
        if (active) setTitle(null);
      }
    };
    void check();
    return () => { active = false; };
  }, [code]);
  if (title === null) return <Navigate to={next} replace />;
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
    <YamilookLogo />
    {title === undefined ? <p role="status">{uiText('A carregar…')}</p> : <>
      <h1 className="break-words text-3xl font-semibold">{title}</h1>
      <p>{uiText('Recebeste um convite pessoal para te inscreveres na Yamilook.')}</p>
      <Button asChild><Link to={next} replace>{uiText('Aceitar convite e inscrever-me')}</Link></Button>
      {shared && <ShareRegistrationInvite code={code} />}
    </>}
  </main>;
}

export default function Register() {
  const { search } = useLocation();
  const code = new URLSearchParams(search).get('ref') ?? '';
  const next = `/onboarding${search}`;
  return /^[\da-f]{16}$/i.test(code) ? <InvitationEntry key={code} code={code} next={next} /> : <Navigate to={next} replace />;
}
