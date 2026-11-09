import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmPhoneCode, normalizePhone, phoneAccessEnabled, phoneDirectory, requestPhoneCode } from './api';

export function PhoneAccess({ mode, onSuccess }: { mode: 'login' | 'link'; onSuccess?: () => void }) {
  const { i18n } = useTranslation();
  const pt = i18n.language.startsWith('pt');
  const copy = (a: string, b: string) => pt ? a : b;
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);
  const [consent, setConsent] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [consentLoaded, setConsentLoaded] = useState(false);
  useEffect(() => {
    if (!phoneAccessEnabled || mode !== 'link') return;
    let active = true;
    phoneDirectory('status').then(result => {
      if (active) { setConsent(result.enabled); setConsentLoaded(true); }
    }).catch(() => { if (active) setConsentLoaded(false); });
    return () => { active = false; };
  }, [mode]);
  if (!phoneAccessEnabled) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch { setMessage(copy('Não foi possível concluir. Confirme o número ou código e tente novamente mais tarde.', 'Unable to complete. Check the number or code and try again later.')); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border p-4" aria-label={copy('Acesso por telefone', 'Phone access')}>
    <h2 className="font-semibold">{mode === 'link' ? copy('Associar telefone à minha conta', 'Link phone to my account') : copy('Entrar por SMS', 'Sign in by SMS')}</h2>
    <p className="text-sm text-muted-foreground">{mode === 'link'
      ? copy('Confirme o seu número por SMS. O perfil, as mensagens e o acesso por email são mantidos.', 'Confirm your number by SMS. Your profile, messages and email login are preserved.')
      : copy('Use um número já confirmado nas definições da sua conta.', 'Use a number already confirmed in your account settings.')}</p>
    {!verified && <>
      <label className="block text-sm">{copy('Número de telefone', 'Phone number')}
        <Input type="tel" autoComplete="tel" placeholder="+244 9XX XXX XXX" value={phone} disabled={busy || !!sentTo} onChange={e => setPhone(e.target.value)} />
      </label>
      {sentTo && <label className="block text-sm">{copy('Código recebido por SMS', 'SMS verification code')}
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
      </label>}
      {!sentTo ? <Button type="button" disabled={busy || !normalizePhone(phone)} onClick={() => void run(async () => {
        if (Date.now() < retryAt) { setMessage(copy('Aguarde um minuto antes de pedir outro código.', 'Wait one minute before requesting another code.')); return; }
        setRetryAt(Date.now() + 60000);
        setSentTo(await requestPhoneCode(phone, mode));
        setMessage(copy('Pedido de SMS aceite. Aguarde a receção do código.', 'SMS request accepted. Wait for the code to arrive.'));
      })}>{copy('Pedir código por SMS', 'Request SMS code')}</Button>
      : <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || code.length !== 6} onClick={() => void run(async () => {
        await confirmPhoneCode(sentTo, code, mode); setCode(''); setVerified(true);
        if (mode === 'link') {
          setConsent(false); setConsentLoaded(false);
          const status = await phoneDirectory('status');
          setConsent(status.enabled); setConsentLoaded(true);
        }
        setMessage(copy('Telefone confirmado.', 'Phone confirmed.')); onSuccess?.();
      })}>{copy('Confirmar código', 'Confirm code')}</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => { setSentTo(null); setCode(''); setMessage(''); }}>{copy('Alterar número / pedir novo código', 'Change number / request new code')}</Button></div>}
    </>}
    {mode === 'link' && <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={consent} disabled={busy || !consentLoaded} onChange={e => { const enabled = e.target.checked; void run(async () => { await phoneDirectory('consent', { enabled }); setConsent(enabled); setMessage(copy('Preferência guardada.', 'Preference saved.')); }); }} />
      {copy('Permitir que pessoas com o meu número confirmado encontrem o meu perfil. Pode desativar esta opção a qualquer momento.', 'Allow people with my confirmed number to find my profile. You can disable this at any time.')}
    </label>}
    <p role="status" className="text-sm">{message}</p>
  </section>;
}
