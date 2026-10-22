import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { buildInviteUrl } from '@/lib/referral';

// Keep the generated database snapshot untouched until the migration is applied.
type InvitationDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      issue_user_invitation: { Args: { p_email: string }; Returns: Json };
    };
  };
};
const invitationClient = supabase as unknown as SupabaseClient<InvitationDatabase>;

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteSheet({ open, onOpenChange }: InviteSheetProps) {
  const [status, setStatus] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedFor, setIssuedFor] = useState('');
  const issue = async () => {
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
          <p className="mt-6" role="alert">Código único de convite ainda não está disponível. Actualiza a página. Se continuar em falta, contacta o suporte.</p>
        )}
        <p className="text-sm text-muted-foreground mt-4" role="status">{status}</p>
      </SheetContent>
    </Sheet>
  );
}
