import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildInviteUrl } from '@/lib/referral';
import { Button } from '@/components/ui/button';
import { uiText } from '@/i18n/ui-copy';

export function ShareRegistrationInvite({ code }: { code: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('validate_mvp_access_code', { p_code: code });
      if (error) throw error;
      if (data && typeof data === 'object' && !Array.isArray(data) && data.valid && data.multi_use && typeof data.remaining === 'number' && data.remaining > 0) {
        setRemaining(data.remaining);
      } else setMessage(uiText('Este convite já não está disponível.'));
    } catch { setMessage(uiText('Não foi possível verificar as vagas. Tenta novamente.')); }
    finally { setBusy(false); }
  }
  async function share() {
    const url = buildInviteUrl(code);
    const text = uiText('Convido-te a conhecer a Yamilook. Podes apresentar o teu trabalho, conhecer pessoas e aprender na Academia. Para te inscreveres, abre esta ligação.');
    try {
      if (navigator.share) await navigator.share({ title: 'Yamilook', text, url });
      else { await navigator.clipboard.writeText(text + '\n' + url); setMessage(uiText('Convite copiado.')); }
      setRemaining(null);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setMessage(uiText('Não foi possível partilhar o convite.'));
      setRemaining(null);
    }
  }
  return <div className="space-y-2">
    {remaining === null ? <Button variant="outline" disabled={busy} onClick={check}>{uiText('Partilhar convite')}</Button> :
      <div className="rounded-lg border p-3 space-y-2">
        <p role="status">{uiText('Vagas disponíveis: {{count}}', { count: remaining })}</p>
        <Button onClick={share}>{uiText('Continuar a partilhar')}</Button>{' '}
        <Button variant="ghost" onClick={() => setRemaining(null)}>{uiText('Cancelar')}</Button>
      </div>}
    {message && <p role="status">{message}</p>}
  </div>;
}
