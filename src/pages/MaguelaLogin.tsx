import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export default function MaguelaLogin() {
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const origin = params.get('origin') || '';
  const state = params.get('state') || '';
  const allowed = (import.meta.env.VITE_MAGUELA_LOGIN_ORIGINS || '').split(',').map((value: string) => value.trim()).filter(Boolean);
  const valid = allowed.includes(origin) && /^https:\/\//.test(origin)
    && /^[a-f0-9-]{36}$/i.test(state) && !!window.opener;

  async function approve() {
    if (!valid || !user || busy) return;
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || data.session.user.id !== user.id) throw new Error('Volte a entrar na sua conta.');
      window.opener.postMessage({ type: 'maguela-login', state, token: data.session.access_token }, origin);
      setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível autorizar.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md space-y-5 p-6">
    <h1 className="text-2xl font-bold">Entrar na MAGUELA</h1>
    {!valid ? <p role="alert">Pedido inválido. Inicie a entrada na aplicação MAGUELA.</p>
      : loading ? <p role="status">A verificar a sessão…</p>
      : !user ? <p>Entre na Yamilook ou KOSOLOLA e volte a iniciar este pedido na MAGUELA.</p>
      : done ? <p role="status">Autorização enviada. Regresse à MAGUELA.</p>
      : <>
        <p>Autorizar a MAGUELA a verificar a sua sessão e entrar na conta previamente associada?</p>
        <p className="break-all text-sm">{origin}</p>
        <Button disabled={busy} onClick={approve}>Autorizar entrada</Button>
        <Button variant="outline" onClick={() => window.close()}>Cancelar</Button>
      </>}
    {!!error && <p role="alert">{error}</p>}
  </main>;
}
