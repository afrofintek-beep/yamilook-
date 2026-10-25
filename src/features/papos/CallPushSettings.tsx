import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { callPushStatus, disableCallPush, enableCallPush } from '@/lib/call-push';
export default function CallPushSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<{supported: boolean; enabled: boolean; publicKey: string | null} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let alive = true;
    callPushStatus(user.id).then(value => { if (alive) setStatus(value); }).catch(() => { if (alive) setError('Serviço de alertas indisponível. Volta a abrir as Definições para tentar novamente.'); });
    return () => { alive = false; };
  }, [user?.id]);
  const change = async () => {
    if (!user || !status || busy) return;
    setBusy(true); setError('');
    try {
      if (status.enabled) await disableCallPush();
      else if (status.publicKey) await enableCallPush(user.id, status.publicKey);
      setStatus(await callPushStatus(user.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível alterar os alertas.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border p-4 space-y-3">
    <h2 className="font-semibold">Alertas de chamadas</h2>
    <p className="text-sm text-muted-foreground">Recebe uma notificação fora da KOSOLOLA. Toca no alerta para abrir a aplicação e atender enquanto a chamada estiver a tocar.</p>
    {status && !status.supported && <p className="text-sm">No iPhone, usa Partilhar → Adicionar ao ecrã principal e abre a KOSOLOLA pelo ícone. É necessário iOS 16.4 ou posterior.</p>}
    {status?.supported && !status.publicKey && <p role="status" className="text-sm">O serviço de alertas ainda está a ser configurado.</p>}
    <Button variant="outline" disabled={busy || !status?.supported || (!status.enabled && !status.publicKey)} onClick={() => void change()}>
      {busy ? 'A guardar…' : status?.enabled ? 'Desativar alertas neste dispositivo' : 'Ativar alertas de chamadas'}
    </Button>
    {status?.enabled && <p role="status" className="text-sm">Alertas ativos neste dispositivo.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">Os alertas respeitam o modo Não incomodar e as permissões do telefone. Precisam de internet e não substituem o toque de uma chamada nativa.</p>
  </section>;
}
