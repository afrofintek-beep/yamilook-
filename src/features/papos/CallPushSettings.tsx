import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { callPushStatus, disableCallPush, enableCallPush } from '@/lib/call-push';
export default function CallPushSettings() {
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
    <h2 className="font-semibold">Alertas de chamadas</h2>
    <p className="text-sm text-muted-foreground">Recebe uma notificação fora da KOSOLOLA. Toca no alerta para abrir a aplicação e atender enquanto a chamada estiver a tocar.</p>
    {loading && <p role="status" className="text-sm">A verificar os alertas neste dispositivo…</p>}
    {!user && <p role="status" className="text-sm">Inicia sessão para ativar os alertas.</p>}
    {status?.message && <p role="status" className="text-sm">{status.message}</p>}
    {status?.permission === 'denied' && <p role="status" className="text-sm">As notificações estão bloqueadas. Permite as notificações da KOSOLOLA nas definições do telefone ou do navegador e toca em Tentar novamente.</p>}
    {status?.supported && !status.publicKey && <p role="status" className="text-sm">O serviço de alertas ainda está a ser configurado.</p>}
    <Button variant="outline" disabled={loading || busy || !status?.supported || (!status.enabled && (!status.publicKey || status.permission === 'denied'))} onClick={() => void change()}>
      {loading ? 'A verificar…' : busy ? 'A guardar…' : status?.enabled ? 'Desativar alertas neste dispositivo' : 'Ativar alertas de chamadas'}
    </Button>
    {user && !loading && (error || (status?.supported && (!status.publicKey || status.permission === 'denied'))) && <Button variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button>}
    {status?.enabled && <p role="status" className="text-sm">Alertas ativos neste dispositivo.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">Os alertas respeitam o modo Não incomodar e as permissões do telefone. Precisam de internet e não substituem o toque de uma chamada nativa.</p>
  </section>;
}
