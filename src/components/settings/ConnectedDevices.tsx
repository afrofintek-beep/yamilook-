import { useCallback, useEffect, useState } from 'react';
import { MonitorSmartphone, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { listAccountSessions, listLoginAlerts, revokeAccountSession, type AccountSession, type AccountLoginAlert } from '@/lib/account-sessions';

const localizedTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Shared by Yamilook and KOSOLOLA: these are Auth sessions, not device fingerprints. */
export function ConnectedDevices() {
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
      setError('Não foi possível consultar as sessões. Confirma a ligação e tenta novamente.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  const disconnect = async (target: AccountSession) => {
    if (target.is_current || busyId || !window.confirm(`Terminar o acesso de ${target.device_label}?`)) return;
    setBusyId(target.id);
    try {
      await revokeAccountSession(target.id);
      toast({ title: 'Acesso revogado', description: 'O dispositivo terá de iniciar sessão novamente.' });
      await reload();
    } catch {
      toast({ title: 'Não foi possível revogar o acesso', variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  return <section aria-label="Dispositivos ligados" className="rounded-2xl border p-4 space-y-4">
    <header className="flex items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><MonitorSmartphone className="h-5 w-5" /> Dispositivos ligados</h2>
        <p className="text-xs text-muted-foreground mt-1">Sessões autorizadas na YAMILOOK e na KOSOLOLA.</p>
      </div>
      <Button size="icon" variant="ghost" aria-label="Atualizar dispositivos" disabled={loading} onClick={() => void reload()}>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && !sessions.length && <p role="status" className="text-sm">A consultar dispositivos…</p>}
    {!loading && !error && !sessions.length && <p className="text-sm text-muted-foreground">Nenhuma sessão encontrada.</p>}
    <ul className="space-y-3">
      {sessions.map(s => <li key={s.id} className="rounded-xl border p-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex gap-3">
          <Smartphone aria-hidden="true" className="h-5 w-5 shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="font-medium text-sm break-words">{s.device_label} {s.is_current && <span className="text-primary">(Este dispositivo)</span>}</p>
            <p className="text-xs text-muted-foreground">{s.app_surface === 'kosolola' ? 'KOSOLOLA' : s.app_surface === 'yamilook' ? 'YAMILOOK' : 'Acesso anterior'} · {s.platform}</p>
            <p className="text-xs text-muted-foreground">Última atividade: {localizedTime(s.last_seen)}</p>
          </div>
        </div>
        {!s.is_current && <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => void disconnect(s)} aria-label={`Revogar ${s.device_label}`}>Terminar</Button>}
      </li>)}
    </ul>
    {alerts.length > 0 && <div className="pt-3 border-t space-y-2">
      <h3 className="font-medium text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Histórico de novos acessos</h3>
      <ul className="text-xs text-muted-foreground space-y-1">
        {alerts.slice(0, 5).map(a => <li key={a.id}>{a.device_label} · {localizedTime(a.occurred_at)} {a.unread ? '· Novo' : ''}</li>)}
      </ul>
    </div>}
    <p className="text-xs text-muted-foreground">Terminar um acesso impede a renovação dessa sessão. Uma credencial já emitida poderá permanecer válida até expirar.</p>
  </section>;
}
