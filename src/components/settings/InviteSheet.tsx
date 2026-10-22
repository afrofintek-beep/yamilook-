import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildInviteUrl } from '@/lib/referral';

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode?: string | null;
}

export function InviteSheet({ open, onOpenChange, referralCode }: InviteSheetProps) {
  const [status, setStatus] = useState('');
  const code = referralCode?.trim() || '';
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
          <SheetDescription>Copia o teu código ou envia o link a quem queres convidar. Abrir este painel não envia uma mensagem.</SheetDescription>
        </SheetHeader>
        {code ? (
          <div className="space-y-4 mt-6">
            <label htmlFor="invite-code" className="block font-medium">O teu código de convite</label>
            <Input id="invite-code" value={code} readOnly onFocus={(event) => event.target.select()} className="text-xl font-mono" />
            <Button className="w-full" onClick={() => void copy(code)}>Copiar código</Button>
            <label htmlFor="invite-link" className="block font-medium">Link de convite</label>
            <Input id="invite-link" value={url} readOnly onFocus={(event) => event.target.select()} />
            <Button variant="outline" className="w-full" onClick={() => void copy(url)}>Copiar link</Button>
            <Button variant="outline" className="w-full" onClick={() => void share()}>Enviar convite</Button>
          </div>
        ) : (
          <p className="mt-6" role="alert">O teu código de convite ainda não está disponível. Actualiza a página. Se continuar em falta, contacta o suporte.</p>
        )}
        <p className="text-sm text-muted-foreground mt-4" role="status">{status}</p>
      </SheetContent>
    </Sheet>
  );
}
