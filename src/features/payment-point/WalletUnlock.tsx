import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

async function call(action: string, extra = {}) {
  const { data, error } = await supabase.functions.invoke('wallet-passkey', { body: { action, ...extra } });
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(body?.error || 'Não foi possível verificar a carteira.');
  }
  return data;
}

export function WalletUnlock({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [holder, setHolder] = useState('');
  const [registered, setRegistered] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    async function refresh() {
      try {
        const state = await call('status');
        if (live) {
          setRegistered(state.registered);
          setHolder(state.unlocked ? user?.id ?? '' : '');
        }
      } catch { if (live) { setHolder(''); setError('Não foi possível consultar a protecção da carteira.'); } }
    }
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { live = false; clearInterval(timer); };
  }, [user?.id]);
  async function unlock() {
    setBusy(true); setError('');
    try {
      if (!window.PublicKeyCredential || !PublicKeyCredential.parseRequestOptionsFromJSON) throw new Error('Abre a Yamilook num navegador actualizado com suporte para chaves de acesso.');
      const mode = registered ? 'unlock' : 'register';
      const options = await call(mode + '-options');
      const credential = registered
        ? await navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options) })
        : await navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options) });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('Confirmação cancelada.');
      await call(mode + '-finish', { challenge: options.challenge, response: credential.toJSON() });
      setRegistered(true); setHolder(user?.id ?? '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Confirmação cancelada.'); }
    finally { setBusy(false); }
  }
  if (user && holder === user.id) return <>{children}<Button variant="outline" onClick={async () => {
    try { await call('lock'); setHolder(''); } catch { setError('Não foi possível bloquear a carteira.'); }
  }}>Bloquear carteira</Button>{error && <p role="alert">{error}</p>}</>;
  return <main className="mx-auto max-w-md space-y-4 p-6">
    <h1 className="text-xl font-semibold">CARTEIRA bloqueada</h1>
    <p>Confirma a tua identidade com Face ID ou com o método de desbloqueio do dispositivo.</p>
    <Button disabled={busy || registered === undefined} onClick={unlock}>{registered === false ? 'Activar chave de acesso' : 'Desbloquear CARTEIRA'}</Button>
    {error && <p role="alert">{error}</p>}
    <Button variant="ghost" onClick={() => history.back()}>Voltar</Button>
  </main>;
}
