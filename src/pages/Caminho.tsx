import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const GAME = 'https://caminho.yamilook.com';
type Snapshot = { balance: number; name: string; observedAt: number };
export default function Caminho() {
  const { user, loading, recoveringPassword } = useAuth();
  const frame = useRef<HTMLIFrameElement>(null);
  const [consent, setConsent] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const enabled = !!user && consent === user.id && !recoveringPassword;
  useEffect(() => { setConsent(null); setSnapshot(null); }, [user?.id, recoveringPassword]);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (event.origin !== GAME || event.source !== frame.current?.contentWindow ||
          event.data?.type !== 'yamilook:kumbu:ready:v1' ||
          typeof event.data.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(event.data.nonce)) return;
      setNonce(event.data.nonce);
    };
    window.addEventListener('message', ready);
    return () => window.removeEventListener('message', ready);
  }, []);
  useEffect(() => {
    setSnapshot(null); setError('');
    if (!enabled || !user) return;
    let active = true;
    let pending = false;
    const read = async () => {
      if (pending) return;
      pending = true;
      try {
        const { data, error: failure } = await supabase.from('profiles')
          .select('id,display_name,kumbu_available').eq('id', user.id).single();
        if (!active) return;
        if (failure || !data || data.id !== user.id || !Number.isSafeInteger(data.kumbu_available) || data.kumbu_available < 0) throw new Error('unavailable');
        setSnapshot({ balance: data.kumbu_available, name: String(data.display_name || 'Jogador').slice(0,80), observedAt: Date.now() });
        setError('');
      } catch {
        if (active) { setSnapshot(null); setError('Não foi possível consultar a carteira. Tenta novamente.'); }
      } finally { pending = false; }
    };
    void read();
    const timer = window.setInterval(() => void read(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled, user?.id, refresh]);
  useEffect(() => {
    if (!nonce) return;
    const target = frame.current?.contentWindow;
    target?.postMessage({ type:'yamilook:kumbu:view:v1', nonce,
      ...(enabled && snapshot ? {status:'connected', ...snapshot} : {status:'disconnected'}) }, GAME);
    return () => { target?.postMessage({type:'yamilook:kumbu:view:v1',nonce,status:'disconnected'}, GAME); };
  }, [nonce, enabled, snapshot]);
  return <main className="min-h-screen bg-background text-foreground">
    <header className="mx-auto max-w-7xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/feed" className="font-bold">YAMILOOK</Link>
        <h1 className="font-bold text-xl">O Meu Caminho · 3D</h1>
        <Link to="/kumbu" className="underline">Abrir carteira Kumbu</Link>
      </div>
      <p className="text-sm">Autoriza a consulta do teu nome e saldo Kumbu no jogo. A associação dura apenas nesta página e podes desligá-la a qualquer momento. Não permite pagamentos nem atribui créditos por conquistas.</p>
      <div className="flex flex-wrap gap-3 items-center" aria-live="polite">
        {loading ? <span>A carregar a conta…</span> : recoveringPassword ? <Link to="/reset-password">Concluir recuperação da conta</Link> : !user ?
          <Link className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" to="/login?next=/caminho">Entrar para associar Kumbu</Link> :
          enabled ? <><span>{snapshot ? snapshot.balance.toLocaleString('pt-AO') + ' Kumbu · consulta autorizada' : 'A consultar carteira…'}</span>
            <button className="underline" onClick={() => setRefresh(n => n+1)}>Actualizar saldo</button>
            <button className="rounded-lg border px-4 py-2" onClick={() => {setConsent(null);setSnapshot(null);}}>Desligar carteira</button></> :
          <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={() => setConsent(user.id)}>Autorizar consulta Kumbu</button>}
        {error && enabled && <p role="alert">{error}</p>}
      </div>
    </header>
    <iframe ref={frame} src={GAME + '/'} title="O Meu Caminho — bairro 3D"
      onLoad={() => setNonce(null)} referrerPolicy="strict-origin"
      sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
      style={{width:'100%',height:'calc(100dvh - 190px)',minHeight:600,border:0}} />
  </main>;
}
