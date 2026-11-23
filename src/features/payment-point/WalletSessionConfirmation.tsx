import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function WalletSessionConfirmation({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function confirm() {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factor = data.totp.find(item => item.status === 'verified');
      if (!factor) {
        setNeedsSetup(true);
        return;
      }
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (result.error) {
        setMessage('Não foi possível confirmar. Verifica a ligação e tenta com o código actual.');
      } else {
        setConfirmed(true);
      }
    } catch {
      setMessage('Não foi possível consultar a conta. Tenta novamente.');
    } finally {
      setCode('');
      setBusy(false);
    }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <DialogTitle>{confirmed ? 'Sessão confirmada' : 'Confirmar sessão'}</DialogTitle>
      <DialogDescription>{confirmed ? 'Volta à carteira para autorizar a operação.' :
        'Abre a aplicação de autenticação associada à tua conta Yamilook e consulta o código actual.'}</DialogDescription>
      {confirmed ? <Button onClick={onClose}>Voltar à carteira</Button> : needsSetup ?
        <Link to="/settings">Activar autenticação de dois factores nas definições</Link> :
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void confirm(); }}>
          <label>Código de 6 dígitos<Input autoFocus inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label>
          {message && <p role="alert">{message}</p>}
          <Button disabled={busy || code.length !== 6}>Confirmar sessão</Button>
        </form>}
    </DialogContent>
  </Dialog>;
}
