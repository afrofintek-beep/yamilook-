import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { buildInviteUrl } from '@/lib/referral';

// Keep the generated database snapshot untouched until the migration is applied.
type InvitationDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      can_issue_user_invitation: { Args: { p_user_id: string }; Returns: boolean };
      list_invitation_permissions: { Args: Record<string, never>; Returns: { email: string; granted_at: string }[] };
      set_invitation_permission: { Args: { p_email: string; p_allowed: boolean }; Returns: undefined };
      issue_user_invitation: { Args: { p_email: string }; Returns: Json };
    };
  };
};
const invitationClient = supabase as unknown as SupabaseClient<InvitationDatabase>;

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function InviteSheet({ open, onOpenChange, isAdmin = false }: InviteSheetProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [allowedUser, setAllowedUser] = useState<string | null>(null);
  const allowed = !!userId && allowedUser === userId;
  const [delegateEmail, setDelegateEmail] = useState('');
  const [delegates, setDelegates] = useState<{ email: string; granted_at: string }[]>([]);
  const [managing, setManaging] = useState(false);
  useEffect(() => {
    setAllowedUser(null);
    setCode('');
    setDelegates([]);
    if (!open || !userId) return;
    let active = true;
    invitationClient.rpc('can_issue_user_invitation', { p_user_id: userId }).then(({ data, error }) => {
      if (active) setAllowedUser(!error && data === true ? userId : null);
    });
    if (isAdmin) invitationClient.rpc('list_invitation_permissions', {}).then(({ data, error }) => {
      if (active && !error) setDelegates(data ?? []);
    });
    return () => { active = false; };
  }, [open, userId, isAdmin]);
  const managePermission = async (address: string, grant: boolean) => {
    setManaging(true);
    try {
      const { error } = await invitationClient.rpc('set_invitation_permission', { p_email: address.trim().toLowerCase(), p_allowed: grant });
      if (error) throw error;
      const result = await invitationClient.rpc('list_invitation_permissions', {});
      if (result.error) throw result.error;
      setDelegates(result.data ?? []);
      setDelegateEmail('');
      setStatus(grant ? 'Autorização concedida.' : 'Autorização retirada.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível alterar a autorização.');
    } finally { setManaging(false); }
  };
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedFor, setIssuedFor] = useState('');
  const issue = async () => {
    if (!allowed) return;
    setIssuing(true);
    setStatus('');
    try {
      const { data, error } = await invitationClient.rpc('issue_user_invitation', { p_email: email.trim().toLowerCase() });
      if (error) throw error;
      const result = data as { code?: string } | null;
      if (!result?.code) throw new Error('Não foi possível gerar o convite.');
      setCode(result.code);
      setIssuedFor(email.trim().toLowerCase());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível gerar o convite. Tenta novamente.');
    } finally {
      setIssuing(false);
    }
  };
  const url = code ? buildInviteUrl(code) : '';

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copiado. Cola o convite na mensagem para o teu convidado.');
    } catch {
      setStatus('Não foi possível copiar automaticamente. Selecciona o código ou o link acima e copia manualmente.');
    }
  };

  const share = async () => {
    const data = { title: 'Yamilook', text: `Junta-te a mim no Yamilook! Código de convite: ${code}`, url };
    try {
      if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) {
        setStatus('A partilha não está disponível neste navegador. Copia o código ou o link e envia por mensagem.');
        return;
      }
      await navigator.share(data);
      setStatus('Partilha concluída.');
    } catch (error) {
      setStatus((error as Error).name === 'AbortError'
        ? 'Partilha cancelada. O código e o link continuam disponíveis abaixo.'
        : 'Não foi possível partilhar. Copia o código ou o link e envia por mensagem.');
    }
  };

  return (
    <Sheet open={open} onOpenChange={(value) => { setStatus(''); onOpenChange(value); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Convidar para o Yamilook</SheetTitle>
          <SheetDescription>Gera um código único para o email da pessoa convidada. Só pode ser usado uma vez. Gerar o código não envia um email.</SheetDescription>
        </SheetHeader>
        {allowed ? <>
        <form className="space-y-3 mt-6" onSubmit={(event) => { event.preventDefault(); void issue(); }}>
          <label htmlFor="invite-email" className="block font-medium">Email da pessoa convidada</label>
          <Input id="invite-email" type="email" required value={email} disabled={issuing}
            onChange={(event) => { setEmail(event.target.value); setCode(''); setStatus(''); }} />
          <Button type="submit" disabled={issuing || !email.trim()} className="w-full">
            {issuing ? 'A gerar convite…' : 'Gerar código único'}
          </Button>
        </form>
        {code ? (
          <div className="space-y-4 mt-6">
            <p>Convite para {issuedFor}. Este código é de utilização única.</p>
            <label htmlFor="invite-code" className="block font-medium">Código único de convite</label>
            <Input id="invite-code" value={code} readOnly onFocus={(event) => event.target.select()} className="text-xl font-mono" />
            <Button className="w-full" onClick={() => void copy(code)}>Copiar código</Button>
            <label htmlFor="invite-link" className="block font-medium">Link de convite</label>
            <Input id="invite-link" value={url} readOnly onFocus={(event) => event.target.select()} />
            <Button variant="outline" className="w-full" onClick={() => void copy(url)}>Copiar link</Button>
            <Button variant="outline" className="w-full" onClick={() => void share()}>Enviar convite</Button>
          </div>
        ) : (
          <p className="mt-6">Introduz o email para gerar o convite.</p>
        )}
        </> : <p className="mt-6">No MVP, apenas o administrador e as pessoas por ele autorizadas podem enviar convites.</p>}
        {isAdmin && <section className="mt-8 space-y-3 border-t pt-4">
          <h3 className="font-semibold">Pessoas autorizadas a convidar</h3>
          <p className="text-sm text-muted-foreground">Autoriza uma conta existente. Esta permissão não dá acesso à administração.</p>
          <form onSubmit={(event) => { event.preventDefault(); void managePermission(delegateEmail, true); }} className="space-y-3">
            <label htmlFor="delegate-email">Email do utilizador</label>
            <Input id="delegate-email" type="email" required value={delegateEmail} onChange={(event) => setDelegateEmail(event.target.value)} disabled={managing} />
            <Button type="submit" disabled={managing || !delegateEmail.trim()}>Autorizar convites</Button>
          </form>
          {delegates.map((delegate) => <div key={delegate.email} className="flex items-center justify-between gap-2">
            <span className="break-all text-sm">{delegate.email}</span>
            <Button variant="outline" disabled={managing} onClick={() => void managePermission(delegate.email, false)}>Retirar autorização</Button>
          </div>)}
        </section>}
        <p className="text-sm text-muted-foreground mt-4" role="status">{status}</p>
      </SheetContent>
    </Sheet>
  );
}
