import { useTranslation } from 'react-i18next';
import { callPushMessageKey } from './call-push-message-key';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { callPushStatus, disableCallPush, enableCallPush } from '@/lib/call-push';
export default function CallPushSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof callPushStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const current = ++generation.current;
    setStatus(null); setError(''); setBusy(false); setLoading(!!user);
    if (!user) return;
    let alive = true;
    callPushStatus(user.id)
      .then(value => { if (alive) setStatus(value); })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Serviço de alertas indisponível. Toca em Tentar novamente.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; if (generation.current === current) generation.current++; };
  }, [user?.id, attempt]);
  const change = async () => {
    if (!user || !status || busy || loading) return;
    const current = generation.current;
    setBusy(true); setError('');
    try {
      if (status.enabled) await disableCallPush();
      else if (status.publicKey) await enableCallPush(user.id, status.publicKey);
      const updated = await callPushStatus(user.id);
      if (generation.current === current) setStatus(updated);
    } catch (err) { if (generation.current === current) setError(err instanceof Error ? err.message : 'Não foi possível alterar os alertas.'); }
    finally { if (generation.current === current) setBusy(false); }
  };
  return <section className="rounded-2xl border p-4 space-y-3">
    <h2 className="font-semibold">{t('kosolola.pushTitle')}</h2>
    <p className="text-sm text-muted-foreground">{t('kosolola.pushDescription')}</p>
    {loading && <p role="status" className="text-sm">{t('kosolola.pushChecking')}</p>}
    {!user && <p role="status" className="text-sm">{t('kosolola.pushSignIn')}</p>}
    {status?.message && <p role="status" className="text-sm">{t(callPushMessageKey(status.message, 'kosolola.pushUnavailable'))}</p>}
    {status?.permission === 'denied' && <p role="status" className="text-sm">{t('kosolola.pushDenied')}</p>}
    {status?.supported && !status.publicKey && <p role="status" className="text-sm">{t('kosolola.pushConfiguring')}</p>}
    <Button className="h-auto min-h-11 max-w-full whitespace-normal text-start" variant="outline" disabled={loading || busy || !status?.supported || (!status.enabled && (!status.publicKey || status.permission === 'denied'))} onClick={() => void change()}>
      {loading ? t('kosolola.checking') : busy ? t('kosolola.saving') : status?.enabled ? t('kosolola.pushDisable') : t('kosolola.pushEnable')}
    </Button>
    {user && !loading && (error || (status?.supported && (!status.publicKey || status.permission === 'denied'))) && <Button className="h-auto min-h-11 max-w-full whitespace-normal text-start" variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>{t('kosolola.retry')}</Button>}
    {status?.enabled && <p role="status" className="text-sm">{t('kosolola.pushActive')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{t(callPushMessageKey(error, 'kosolola.pushChangeError'))}</p>}
    <p className="text-xs text-muted-foreground">{t('kosolola.pushHelp')}</p>
  </section>;
}
