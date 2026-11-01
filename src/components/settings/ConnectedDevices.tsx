import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { MonitorSmartphone, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { listAccountSessions, listLoginAlerts, revokeAccountSession, type AccountSession, type AccountLoginAlert } from '@/lib/account-sessions';


/** Shared by Yamilook and KOSOLOLA: these are Auth sessions, not device fingerprints. */
export function ConnectedDevices() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
  const localizedTime = (timestamp: string) => new Date(timestamp).toLocaleString(i18n.language === 'pt-banda' ? 'pt-AO' : i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [alerts, setAlerts] = useState<AccountLoginAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [active, history] = await Promise.all([listAccountSessions(), listLoginAlerts()]);
      setSessions(active);
      setAlerts(history);
      setError('');
    } catch {
      setError('kosolola.devicesLoadError');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  const disconnect = async (target: AccountSession) => {
    if (target.is_current || busyId || !window.confirm(t('kosolola.devicesConfirm', { device: target.device_label }))) return;
    setBusyId(target.id);
    try {
      await revokeAccountSession(target.id);
      toast({ title: t('kosolola.devicesRevoked'), description: t('kosolola.devicesRevokedDescription') });
      await reload();
    } catch {
      toast({ title: t('kosolola.devicesRevokeError'), variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  return <section aria-label={t('kosolola.devicesTitle')} className="rounded-2xl border p-4 space-y-4">
    <header className="flex items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><MonitorSmartphone className="h-5 w-5" /> {t('kosolola.devicesTitle')}</h2>
        <p className="text-xs text-muted-foreground mt-1">{t('kosolola.devicesDescription')}</p>
      </div>
      <Button size="icon" variant="ghost" aria-label={t('kosolola.devicesRefresh')} disabled={loading} onClick={() => void reload()}>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    {loading && !sessions.length && <p role="status" className="text-sm">{t('kosolola.devicesLoading')}</p>}
    {!loading && !error && !sessions.length && <p className="text-sm text-muted-foreground">{t('kosolola.devicesEmpty')}</p>}
    <ul className="space-y-3">
      {sessions.map(s => <li key={s.id} className="rounded-xl border p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex gap-3">
          <Smartphone aria-hidden="true" className="h-5 w-5 shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="font-medium text-sm break-words"><bdi>{s.device_label}</bdi> {s.is_current && <span className="text-primary">{t('kosolola.devicesCurrent')}</span>}</p>
            <p className="text-xs text-muted-foreground">{s.app_surface === 'kosolola' ? 'KOSOLOLA' : s.app_surface === 'yamilook' ? 'YAMILOOK' : t('kosolola.devicesPrevious')} · {s.platform}</p>
            <p className="text-xs text-muted-foreground">{t('kosolola.devicesLastActive', { time: localizedTime(s.last_seen) })}</p>
          </div>
        </div>
        {!s.is_current && <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => void disconnect(s)} aria-label={t('kosolola.devicesRevokeLabel', { device: s.device_label })}>{t('kosolola.devicesEnd')}</Button>}
      </li>)}
    </ul>
    {alerts.length > 0 && <div className="pt-3 border-t space-y-2">
      <h3 className="font-medium text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {t('kosolola.devicesHistory')}</h3>
      <ul className="text-xs text-muted-foreground space-y-1">
        {alerts.slice(0, 5).map(a => <li key={a.id}><bdi>{a.device_label}</bdi> · {localizedTime(a.occurred_at)} {a.unread ? `· ${t('kosolola.devicesNew')}` : ''}</li>)}
      </ul>
    </div>}
    <p className="text-xs text-muted-foreground">{t('kosolola.devicesNotice')}</p>
  </section>;
}
