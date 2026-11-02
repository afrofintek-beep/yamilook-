import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useCallback, useEffect, useState } from 'react';
import { MonitorSmartphone, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { listAccountSessions, listLoginAlerts, revokeAccountSession, type AccountSession, type AccountLoginAlert } from '@/lib/account-sessions';

const localizedTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString(i18n.resolvedLanguage || i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

/** Shared by Yamilook and KOSOLOLA: these are Auth sessions, not device fingerprints. */
export function ConnectedDevices() {
  useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
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
      setError(i18n.t('settingsScreen.text41'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  const disconnect = async (target: AccountSession) => {
    if (target.is_current || busyId || !window.confirm(i18n.t('settingsScreen.revokeConfirm', { device: target.device_label }))) return;
    setBusyId(target.id);
    try {
      await revokeAccountSession(target.id);
      toast({ title: i18n.t('settingsScreen.text42'), description: i18n.t('settingsScreen.text43') });
      await reload();
    } catch {
      toast({ title: i18n.t('settingsScreen.text44'), variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  return <section aria-label={i18n.t('settingsScreen.text29')} className="rounded-2xl border p-4 space-y-4">
    <header className="flex items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><MonitorSmartphone className="h-5 w-5" /> {i18n.t('settingsScreen.text29')}</h2>
        <p className="text-xs text-muted-foreground mt-1">{i18n.t('settingsScreen.text30')}</p>
      </div>
      <Button size="icon" variant="ghost" aria-label={i18n.t('settingsScreen.text31')} disabled={loading} onClick={() => void reload()}>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && !sessions.length && <p role="status" className="text-sm">{i18n.t('settingsScreen.text32')}</p>}
    {!loading && !error && !sessions.length && <p className="text-sm text-muted-foreground">{i18n.t('settingsScreen.text33')}</p>}
    <ul className="space-y-3">
      {sessions.map(s => <li key={s.id} className="rounded-xl border p-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex gap-3">
          <Smartphone aria-hidden="true" className="h-5 w-5 shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="font-medium text-sm break-words">{s.device_label} {s.is_current && <span className="text-primary">{i18n.t('settingsScreen.text34')}</span>}</p>
            <p className="text-xs text-muted-foreground">{s.app_surface === 'kosolola' ? 'KOSOLOLA' : s.app_surface === 'yamilook' ? 'YAMILOOK' : i18n.t('settingsScreen.text35')} · {s.platform}</p>
            <p className="text-xs text-muted-foreground">{i18n.t('settingsScreen.text36')} {localizedTime(s.last_seen)}</p>
          </div>
        </div>
        {!s.is_current && <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => void disconnect(s)} aria-label={i18n.t('settingsScreen.revokeLabel', { device: s.device_label })}>{i18n.t('settingsScreen.text37')}</Button>}
      </li>)}
    </ul>
    {alerts.length > 0 && <div className="pt-3 border-t space-y-2">
      <h3 className="font-medium text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {i18n.t('settingsScreen.text38')}</h3>
      <ul className="text-xs text-muted-foreground space-y-1">
        {alerts.slice(0, 5).map(a => <li key={a.id}>{a.device_label} · {localizedTime(a.occurred_at)} {a.unread ? i18n.t('settingsScreen.text39') : ''}</li>)}
      </ul>
    </div>}
    <p className="text-xs text-muted-foreground">{i18n.t('settingsScreen.text40')}</p>
  </section>;
}

