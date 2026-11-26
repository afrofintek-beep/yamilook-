import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useIntegrationAccess } from '@/features/integration-access/useIntegrationAccess';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { uiText as t, useUiLocale } from '@/i18n/ui-copy';
import { maguelaLoginRequest } from './request';

export default function MaguelaAuthorization() {
  useUiLocale();
  const location = useLocation();
  const request = maguelaLoginRequest(location.search);
  const { user, loading } = useAuth();
  const access = useIntegrationAccess();
  const busy = useRef(false);
  const [status, setStatus] = useState<'ready' | 'pending' | 'error' | 'done'>('ready');
  const opener = window.opener;
  const next = encodeURIComponent(location.pathname + location.search);

  function cancel() {
    if (!request || !opener) return;
    opener.postMessage({ type: 'maguela-login-cancelled', state: request.state }, request.origin);
    window.close();
  }

  async function authorize() {
    if (!request || !opener || !user || !access.maguela || busy.current) return;
    busy.current = true;
    setStatus('pending');
    try {
      const { data, error } = await supabase.functions.invoke('maguela-identity-bridge', {
        body: { action: 'authorize-login', origin: request.origin, challenge: request.challenge, consent: true },
      });
      if (error || data?.ok !== true || typeof data.code !== 'string' || !/^[a-f0-9]{64}$/.test(data.code)) {
        throw new Error();
      }
      opener.postMessage({ type: 'maguela-login', state: request.state, code: data.code }, request.origin);
      setStatus('done');
      window.close();
    } catch {
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }

  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
    <h1 className="text-2xl font-semibold">{t('Autorizar entrada na MAGUELA')}</h1>
    {!request || !opener ? <p role="alert">{t('Inicia o pedido na aplicação MAGUELA.')}</p> :
      loading || (user && access.loading) ? <p role="status">{t('A verificar sessão…')}</p> :
      !user ? <Button asChild><Link to={`/login?next=${next}`}>{t('Entrar na Yamilook')}</Link></Button> :
      !access.maguela ? <p role="alert">{t('A tua conta não tem acesso à integração MAGUELA.')}</p> :
      <>
        <p>{t('Autoriza a entrada com a tua conta já associada à MAGUELA.')}</p>
        <Button disabled={status === 'pending' || status === 'done'} onClick={() => void authorize()}>{t('Autorizar entrada')}</Button>
        <Button variant="outline" disabled={status === 'pending'} onClick={cancel}>{t('Cancelar')}</Button>
        {status === 'error' && <p role="alert">{t('Não foi possível autorizar. Confirma a associação à MAGUELA e tenta novamente.')}</p>}
        {status === 'done' && <p role="status">{t('Entrada autorizada. Volta à MAGUELA.')}</p>}
      </>}
  </main>;
}
