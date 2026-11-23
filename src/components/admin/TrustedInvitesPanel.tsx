import { useCallback, useEffect, useId, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Link as LinkIcon, Loader2, ShieldCheck, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUiLocale } from '@/i18n/ui-copy';
import { normalizePhone } from '@/features/phone-access/api';
import {
  buildTrustedInviteUrl, invitationState, trustedInvitationRequest, trustedInviteLanguage,
  type TrustedInvitation, type TrustedInviteLanguage, type TrustedInviteMode,
} from '@/features/trusted-invites/api';
import { trustedCopy, trustedErrorMessage, trustedInviteMessage } from '@/features/trusted-invites/copy';

export function TrustedInvitesPanel() {
  const locale = useUiLocale();
  const copy = trustedCopy(locale);
  const id = useId();
  const [mode, setMode] = useState<TrustedInviteMode>('direct');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<TrustedInviteLanguage>(() => trustedInviteLanguage(locale));
  const [hours, setHours] = useState(72);
  const [smsReady, setSmsReady] = useState<boolean | null>(null);
  const [invitations, setInvitations] = useState<TrustedInvitation[]>([]);
  const [issued, setIssued] = useState<{ invitation: TrustedInvitation; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [listFailed, setListFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListFailed(false);
    const [availability, list] = await Promise.allSettled([
      trustedInvitationRequest<{ sms_ready: boolean }>('status'),
      trustedInvitationRequest<{ invitations: TrustedInvitation[] }>('list'),
    ]);
    setSmsReady(availability.status === 'fulfilled' && availability.value.sms_ready === true);
    if (list.status === 'fulfilled') setInvitations(list.value.invitations || []);
    else setListFailed(true);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const edit = (change: () => void) => { change(); setIssued(null); setMessage(''); };
  const issue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || loading || name.trim().length < 2 || (mode === 'phone' && !smsReady)) return;
    const normalizedPhone = mode === 'phone' ? normalizePhone(phone) : null;
    if (mode === 'phone' && !normalizedPhone) { setMessage(copy.invalidPhone); return; }
    setBusy(true);
    setMessage('');
    setIssued(null);
    try {
      const result = await trustedInvitationRequest<{ invitation: TrustedInvitation; token: string }>('issue', {
        mode, recipient_name: name.trim(), language, expires_hours: hours,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      });
      // Refuse to display a malformed secret or a response with missing provenance.
      buildTrustedInviteUrl(result.token, language);
      if (!result.invitation?.id) throw new Error('invalid_response');
      setIssued(result);
      setInvitations(previous => [result.invitation, ...previous.filter(item => item.id !== result.invitation.id)]);
      setMessage(copy.issued);
    } catch (error) { setMessage(trustedErrorMessage(error, locale)); }
    finally { setBusy(false); }
  };
  const copyValue = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(copy.copied); }
    catch { setMessage(copy.copyFailed); }
  };
  const revoke = async (invitation: TrustedInvitation) => {
    if (revoking || loading || busy) return;
    setRevoking(invitation.id);
    setMessage('');
    try {
      await trustedInvitationRequest('revoke', { id: invitation.id });
      if (issued?.invitation.id === invitation.id) setIssued(null);
      setInvitations(previous => previous.map(item => item.id === invitation.id ? { ...item, status: 'revoked', revoked_at: new Date().toISOString() } : item));
      setMessage(copy.cancelled);
    } catch (error) { setMessage(trustedErrorMessage(error, locale)); }
    finally { setRevoking(null); }
  };
  const link = issued ? buildTrustedInviteUrl(issued.token, issued.invitation.language) : '';
  const shareText = issued ? trustedInviteMessage(issued.invitation.recipient_name, link, issued.invitation.language, issued.invitation.mode) : '';
  const formatDate = (value: string) => new Date(value).toLocaleString(locale === 'pt-banda' ? 'pt-AO' : locale, { dateStyle: 'medium', timeStyle: 'short' });

  return <Card id="convites-confianca" className="min-w-0 overflow-hidden">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />{copy.title}</CardTitle>
      <CardDescription>{copy.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <form onSubmit={issue} className="space-y-4">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{copy.title}</legend>
          {(['direct', 'phone'] as const).map(option => <label key={option} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${mode === option ? 'border-primary bg-primary/5' : 'border-border'} ${option === 'phone' && !smsReady ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input type="radio" name={id + '-mode'} value={option} checked={mode === option} disabled={option === 'phone' && !smsReady}
              onChange={() => edit(() => setMode(option))} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
            <span><span className="flex items-center gap-2 font-semibold">{option === 'direct' ? <LinkIcon className="h-4 w-4" aria-hidden="true" /> : <Smartphone className="h-4 w-4" aria-hidden="true" />}{copy[option]}</span>
              <span className="mt-1 block text-muted-foreground">{copy[option === 'direct' ? 'directHint' : 'phoneHint']}</span></span>
          </label>)}
        </fieldset>
        {smsReady !== true && <p className="text-xs text-muted-foreground" role="status">{smsReady === null ? copy.smsChecking : copy.smsUnavailable}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium" htmlFor={id + '-name'}>{copy.recipient}
            <Input id={id + '-name'} value={name} required minLength={2} maxLength={100} autoComplete="off" placeholder={copy.recipientPlaceholder} disabled={busy} onChange={event => edit(() => setName(event.target.value))} className="text-base" />
          </label>
          {mode === 'phone' && <label className="space-y-1 text-sm font-medium" htmlFor={id + '-phone'}>{copy.phoneNumber}
            <Input id={id + '-phone'} type="tel" value={phone} required autoComplete="off" maxLength={24} placeholder="+244 9XX XXX XXX" disabled={busy} onChange={event => edit(() => setPhone(event.target.value))} className="text-base" />
          </label>}
          <label className="space-y-1 text-sm font-medium" htmlFor={id + '-language'}>{copy.language}
            <select id={id + '-language'} value={language} disabled={busy} onChange={event => edit(() => setLanguage(event.target.value as TrustedInviteLanguage))} className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-base">
              <option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium" htmlFor={id + '-hours'}>{copy.validity}
            <select id={id + '-hours'} value={hours} disabled={busy} onChange={event => edit(() => setHours(Number(event.target.value)))} className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-base">
              {[24, 72, 168].map(value => <option key={value} value={value}>{value} {copy.hours}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{copy.expiryHint}</p>
        <Button type="submit" disabled={busy || loading || name.trim().length < 2 || (mode === 'phone' && (!smsReady || !normalizePhone(phone)))} className="min-h-11 w-full sm:w-auto">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? copy.issuing : copy.issue}
        </Button>
      </form>

      <p role="status" aria-live="polite" className="text-sm">{message}</p>

      {issued && <section className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label={copy.forRecipient + ' ' + issued.invitation.recipient_name}>
        <div><h3 className="font-semibold">{copy.forRecipient} {issued.invitation.recipient_name}</h3><p className="text-sm text-muted-foreground">{copy.expires} {formatDate(issued.invitation.expires_at)}</p></div>
        <div className="mx-auto w-fit max-w-full rounded-xl bg-white p-2">
          <QRCodeSVG value={link} size={216} level="M" marginSize={4} title={copy.title} style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
        <label className="block space-y-1 text-sm font-medium" htmlFor={id + '-link'}>{copy.link}<Input id={id + '-link'} readOnly value={link} onFocus={event => event.target.select()} className="text-base" /></label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void copyValue(link)}><Copy className="mr-2 h-4 w-4" aria-hidden="true" />{copy.copyLink}</Button>
          <Button type="button" variant="outline" onClick={() => void copyValue(shareText)}>{copy.copyMessage}</Button>
          <Button type="button" variant="outline" asChild><a href={'https://wa.me/?text=' + encodeURIComponent(shareText)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{copy.whatsapp}</a></Button>
        </div>
        <p className="text-xs text-muted-foreground">{copy.privateLink}</p>
      </section>}

      <section className="space-y-3 border-t pt-4" aria-labelledby={id + '-recent'}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id={id + '-recent'} className="font-semibold">{copy.recent}</h3><Button type="button" variant="ghost" disabled={loading || busy || !!revoking} onClick={() => void refresh()}>{copy.refresh}</Button></div>
        {loading ? <p role="status" className="text-sm text-muted-foreground">{copy.loading}</p> : listFailed ? <p role="alert" className="text-sm text-destructive">{copy.listError}</p> : !invitations.length ? <p className="text-sm text-muted-foreground">{copy.noInvites}</p> : null}
        {invitations.map(invitation => {
          const state = invitationState(invitation);
          const stateLabel = ['pending', 'used', 'revoked', 'expired'].includes(state) ? copy[state as 'pending' | 'used' | 'revoked' | 'expired'] : state;
          return <article key={invitation.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1 break-words"><h4 className="font-medium">{invitation.recipient_name}</h4><p className="text-sm">{copy[invitation.mode]} · {stateLabel}</p>
              {invitation.inviter_name && <p className="text-xs text-muted-foreground">{copy.invitedBy} {invitation.inviter_name}</p>}
              {invitation.masked_phone && <p className="text-xs text-muted-foreground">{invitation.masked_phone}</p>}
              <p className="text-xs text-muted-foreground">{copy.expires} {formatDate(invitation.expires_at)}</p></div>
            {state === 'pending' && <Button type="button" size="sm" variant="outline" disabled={loading || busy || !!revoking} aria-label={copy.cancel + ': ' + invitation.recipient_name} onClick={() => void revoke(invitation)}><X className="mr-1 h-4 w-4" aria-hidden="true" />{copy.cancel}</Button>}
          </article>;
        })}
      </section>
    </CardContent>
  </Card>;
}
