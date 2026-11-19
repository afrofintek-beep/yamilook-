import { type ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Access = { allowed: boolean; admin: boolean };
type Guest = { user_id: string; name: string; username: string };
async function manage<T>(action: string, identifier?: string): Promise<T> {
  const { data, error } = await supabase.rpc('wallet_pilot_manage' as never, {
    p_action: action, p_identifier: identifier ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as T;
}
export function useWalletAccess() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['wallet-access', user?.id],
    queryFn: () => manage<Access>('status'),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 30000,
  });
  return { allowed: !!user && !query.isError && !!query.data?.allowed, admin: !!user && !query.isError && !!query.data?.admin, loading: !!user && query.isPending, error: query.error, retry: query.refetch };
}
export function WalletAccessGate({ children, silent = false }: { children: ReactNode; silent?: boolean }) {
  const access = useWalletAccess();
  if (access.allowed) return <>{children}</>;
  if (silent) return null;
  return <main className="min-h-screen bg-background p-6 safe-top space-y-4">
    <h1 className="text-xl font-semibold">Carteira e Kumbu</h1>
    <p>{access.loading ? 'A verificar acesso…' : access.error ? 'Não foi possível verificar o acesso.' : 'Até ao lançamento, o acesso está reservado aos administradores e às contas convidadas por estes. Entre com a conta que recebeu autorização.'}</p>
    {access.error && <Button onClick={() => void access.retry()}>Tentar novamente</Button>}
    <Button asChild variant="outline"><Link to="/feed">Voltar à Yamilook</Link></Button>
  </main>;
}
export function WalletAccessManager() {
  const access = useWalletAccess();
  const client = useQueryClient();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const guests = useQuery({ queryKey: ['wallet-pilot-guests'], queryFn: () => manage<Guest[]>('list'), enabled: access.admin });
  async function change(action: string, target: string) {
    setBusy(true); setMessage('');
    try {
      const updated = await manage<Guest[]>(action, target);
      client.setQueryData(['wallet-pilot-guests'], updated);
      setIdentifier('');
      setMessage(action === 'grant' ? 'Acesso concedido à conta. Pode partilhar a ligação da carteira.' : 'Acesso revogado.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function share() {
    const url = `${location.origin}/payment-point`;
    try {
      if (navigator.share) await navigator.share({ title: 'Acesso à carteira Yamilook', text: 'Entre com a conta autorizada pelo administrador.', url });
      else { await navigator.clipboard.writeText(url); setMessage('Ligação copiada.'); }
    } catch (error) { if ((error as Error).name !== 'AbortError') setMessage('Não foi possível partilhar.'); }
  }
  if (!access.admin) return null;
  return <section className="rounded-xl border p-4 space-y-3">
    <h2 className="font-semibold">Acessos antes do lançamento</h2>
    <p className="text-sm text-muted-foreground">Autorize uma conta para utilizar a carteira e o Kumbu. A ligação só funciona para contas autorizadas.</p>
    <label className="block text-sm">Nome de utilizador ou email<Input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="@utilizador ou email" /></label>
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !identifier.trim()} onClick={() => void change('grant', identifier)}>Conceder acesso</Button><Button variant="outline" onClick={() => void share()}>Partilhar ligação</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {guests.error && <p role="alert">Não foi possível consultar os acessos.</p>}
    {guests.data?.map(guest => <div key={guest.user_id} className="flex items-center justify-between gap-2 border-t pt-2"><span className="text-sm">{guest.name || guest.username} <span className="text-muted-foreground">@{guest.username}</span></span><Button variant="outline" disabled={busy} onClick={() => void change('revoke', guest.user_id)}>Revogar</Button></div>)}
  </section>;
}
