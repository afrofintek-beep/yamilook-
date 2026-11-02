import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { callPushStatus, disableCallPush, enableCallPush } from '@/lib/call-push';
export default function CallPushSettings() {
  useTranslation();
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
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : i18n.t('settingsScreen.text27')); })
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
    } catch (err) { if (generation.current === current) setError(err instanceof Error ? err.message : i18n.t('settingsScreen.text28')); }
    finally { if (generation.current === current) setBusy(false); }
  };
  return <section className="rounded-2xl border p-4 space-y-3">
    <h2 className="font-semibold">{i18n.t('settingsScreen.text14')}</h2>
    <p className="text-sm text-muted-foreground">{i18n.t('settingsScreen.text15')}</p>
    {loading && <p role="status" className="text-sm">{i18n.t('settingsScreen.text16')}</p>}
    {!user && <p role="status" className="text-sm">{i18n.t('settingsScreen.text17')}</p>}
    {status?.message && <p role="status" className="text-sm">{status.message}</p>}
    {status?.permission === 'denied' && <p role="status" className="text-sm">{i18n.t('settingsScreen.text18')}</p>}
    {status?.supported && !status.publicKey && <p role="status" className="text-sm">{i18n.t('settingsScreen.text19')}</p>}
    <Button variant="outline" disabled={loading || busy || !status?.supported || (!status.enabled && (!status.publicKey || status.permission === 'denied'))} onClick={() => void change()}>
      {loading ? i18n.t('settingsScreen.text20') : busy ? i18n.t('settingsScreen.text21') : status?.enabled ? i18n.t('settingsScreen.text22') : i18n.t('settingsScreen.text23')}
    </Button>
    {user && !loading && (error || (status?.supported && (!status.publicKey || status.permission === 'denied'))) && <Button variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>{i18n.t('settingsScreen.text24')}</Button>}
    {status?.enabled && <p role="status" className="text-sm">{i18n.t('settingsScreen.text25')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">{i18n.t('settingsScreen.text26')}</p>
  </section>;
}

