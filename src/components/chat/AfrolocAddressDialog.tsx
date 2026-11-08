import { useState } from 'react';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { njilaAddressUrl } from '@/lib/chat-afroloc';

export function AfrolocAddressDialog({ onClose, onAdd, disabled }: {
  onClose: () => void; onAdd: (content: string) => void; disabled?: boolean;
}) {
  useUiLocale();
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const href = njilaAddressUrl(reference);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{uiText("Endereço AFROLOC")}</DialogTitle>
        <DialogDescription>{uiText("Partilha o código de um local público, como uma loja. Não é necessário partilhar a tua localização actual.")}</DialogDescription>
      </DialogHeader>
      <label className="space-y-1 text-sm">{uiText("Nome do local")}<Input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
      <label className="space-y-1 text-sm">{uiText("Código AFROLOC")}<Input value={reference} maxLength={128} dir="ltr" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={e => setReference(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">{uiText("Código fornecido pelo remetente. O NJILA consulta a disponibilidade pública do endereço.")}</p>
      <Button disabled={disabled || !href} onClick={() => {
        if (!href || disabled) return;
        onAdd([name.trim(), `📍 ${href}`].filter(Boolean).join('\n'));
        onClose();
      }}>{uiText("Adicionar à mensagem")}</Button>
    </DialogContent>
  </Dialog>;
}
