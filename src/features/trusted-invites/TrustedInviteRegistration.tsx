import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUiLocale } from '@/i18n/ui-copy';
import { changeAppLanguage } from '@/i18n';
import { afrolocReturn } from '@/features/locaccess/return-path';
import { isTrustedPasswordValid } from '@/lib/trusted-account-login';
import {
  invitationState, readTrustedInvitationInput, readTrustedInvitationToken, trustedInvitationRequest, trustedInviteLanguage,
  type TrustedActivation, type TrustedInvitationPreview,
} from './api';
import { trustedCopy, trustedErrorMessage } from './copy';

export default function TrustedInviteRegistration() {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = useUiLocale();
  const copy = trustedCopy(locale);
  const id = useId();
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState(() => readTrustedInvitationToken(location.hash));
  const [enteredToken, setEnteredToken] = useState('');
  const [preview, setPreview] = useState<TrustedInvitationPreview | null>(null);
  const [checking, setChecking] = useState(!!token);
  const [loadVersion, setLoadVersion] = useState(0);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<TrustedActivation | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionSettling, setSessionSettling] = useState(false);
  const [savedRecovery, setSavedRecovery] = useState(false);
  const activationInProgress = useRef(false);
  const callback = afrolocReturn(location.search);

  useEffect(() => {
    // Another invitation may arrive through SPA navigation without a remount.
    // Preserve a completed activation until its recovery code has been saved.
    if (result) return;
    setToken(readTrustedInvitationToken(location.hash));
    setDisplayName('');
    setUsername('');
    setPassword('');
    setAcceptedTerms(false);
    setOtp('');
    setOtpRequested(false);
    setRetryAt(0);
    setMessage('');
  }, [location.hash, result]);

  useEffect(() => {
    if (!token || result) return;
    let active = true;
    setChecking(true);
    setPreviewError(null);
    setPreview(null);
    trustedInvitationRequest<{ invitation: TrustedInvitationPreview }>('preview', { token })
      .then(({ invitation }) => {
        if (!active) return;
        if (!invitation || invitationState(invitation) !== 'pending') throw { code: 'invalid_invitation' };
        setPreview(invitation);
        setDisplayName(invitation.recipient_name || '');
        if (!new URLSearchParams(location.search).has('lang')) void changeAppLanguage(trustedInviteLanguage(invitation.language));
      })
      .catch(error => { if (active) setPreviewError(error); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token, loadVersion, result, location.search]);

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();
  const validFields = displayName.trim().length >= 2 && displayName.trim().length <= 100 &&
    /^[a-z0-9][a-z0-9_]{2,19}$/.test(normalizedUsername) && isTrustedPasswordValid(password) && acceptedTerms;

  async function requestOtp() {
    if (!token || busy || remaining || user || preview?.mode !== 'phone') return;
    setBusy(true);
    setMessage('');
    try {
      const response = await trustedInvitationRequest<{ retry_after?: number }>('request_otp', { token });
      const delay = Math.max(1, Math.min(600, Number(response.retry_after) || 60));
      setNow(Date.now());
      setRetryAt(Date.now() + delay * 1000);
      setOtpRequested(true);
      setMessage(copy.otpSent);
    } catch (error) { setMessage(trustedErrorMessage(error, locale)); }
    finally { setBusy(false); }
  }

  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || authLoading || user || !token || !preview || activationInProgress.current) return;
    if (!validFields) { setMessage(copy.invalidFields); return; }
    if (preview.mode === 'phone' && !/^\d{6}$/.test(otp)) { setMessage(copy.invalidOtp); return; }
    setBusy(true);
    activationInProgress.current = true;
    setMessage('');
    try {
      const activation = await trustedInvitationRequest<TrustedActivation>('activate', {
        token, username: normalizedUsername, display_name: displayName.trim(), password, accepted_terms: true,
        ...(preview.mode === 'phone' ? { otp } : {}),
      });
      if (!activation.recovery_code) throw new Error('invalid_activation_response');
      setResult(activation);
      setPassword('');
      setOtp('');
      // A spent invitation must not remain in browser history or a copied URL.
      window.history.replaceState(window.history.state, '', location.pathname + location.search);
      if (activation.session) {
        setSessionSettling(true);
        try {
          const session = await supabase.auth.setSession(activation.session);
          setSessionReady(!session.error && !!session.data.session);
        } catch { setSessionReady(false); }
        finally { setSessionSettling(false); }
      }
    } catch (error) { setMessage(trustedErrorMessage(error, locale)); }
    finally { setBusy(false); activationInProgress.current = false; }
  }

  async function copyRecovery() {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.recovery_code); setMessage(copy.recoveryCopied); }
    catch { setMessage(copy.copyFailed); }
  }

  const languageControl = <label className="block text-sm font-medium" htmlFor={id + '-language'}>{copy.language}
    <select id={id + '-language'} value={trustedInviteLanguage(locale)} disabled={busy || sessionSettling}
      onChange={event => void changeAppLanguage(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base">
      <option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option>
    </select>
  </label>;

  return <main className="mx-auto min-h-screen-safe w-full max-w-lg space-y-6 px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.5rem+env(safe-area-inset-top,0px))]" lang={trustedInviteLanguage(locale)}>
    <header className="space-y-4"><YamilookLogo />{languageControl}</header>
    {result ? <section className="space-y-5" aria-labelledby={id + '-success'}>
      <div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" /><h1 id={id + '-success'} className="text-2xl font-semibold">{copy.activated}</h1></div>
      <p className="text-sm">{copy.username}: <strong>@{result.username || normalizedUsername}</strong></p>
      <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
        <h2 className="font-semibold">{copy.recoveryTitle}</h2><p className="text-sm text-muted-foreground">{copy.recoveryHint}</p>
        <label htmlFor={id + '-recovery'} className="block text-sm font-medium">{copy.recoveryCode}</label>
        <Input id={id + '-recovery'} value={result.recovery_code} readOnly autoComplete="off" onFocus={event => event.target.select()} className="font-mono text-base" />
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => void copyRecovery()}><Copy className="mr-2 h-4 w-4" aria-hidden="true" />{copy.copyRecovery}</Button>
      </div>
      {!sessionReady && !sessionSettling && <p role="status" className="text-sm">{copy.sessionFailed}</p>}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={savedRecovery} onChange={event => setSavedRecovery(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />{copy.savedRecovery}</label>
      <Button type="button" className="min-h-12 w-full" disabled={!savedRecovery || sessionSettling} onClick={() => {
        const search = new URLSearchParams({ lang: trustedInviteLanguage(locale) });
        if (callback) search.set('next', callback);
        navigate((sessionReady ? '/onboarding?' : '/login?') + search.toString(), { replace: true });
      }}>{sessionSettling ? copy.loading : sessionReady ? copy.continue : copy.signIn}</Button>
      <p role="status" className="text-sm">{message}</p>
    </section> : authLoading ? <p role="status">{copy.loading}</p> : user ? <section className="space-y-4"><h1 className="text-2xl font-semibold">{copy.title}</h1><p>{copy.existingSession}</p><Button asChild><Link to="/feed">{copy.signIn}</Link></Button></section> : !token ? <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{copy.title}</h1><p className="text-sm text-muted-foreground">{copy.invalidToken}</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        const value = readTrustedInvitationInput(enteredToken);
        if (value) { setToken(value); setEnteredToken(''); setMessage(''); } else setMessage(copy.invalidToken);
      }}>
        <label className="block text-sm font-medium" htmlFor={id + '-token'}>{copy.codeOrLink}<Input id={id + '-token'} value={enteredToken} onChange={event => setEnteredToken(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={512} className="mt-1 font-mono text-base" /></label>
        <Button type="submit" disabled={!enteredToken.trim()} className="w-full">{copy.checkCode}</Button>
      </form><p role="status" className="text-sm">{message}</p>
    </section> : checking ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{copy.loading}</p> : previewError || !preview ? <section className="space-y-4"><h1 className="text-2xl font-semibold">{copy.title}</h1><p role="alert">{trustedErrorMessage(previewError, locale)}</p><Button type="button" variant="outline" onClick={() => setLoadVersion(value => value + 1)}>{copy.retry}</Button><p><Link to="/login" className="text-primary underline">{copy.signIn}</Link></p></section> : <>
      <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" /><h1 className="text-2xl font-semibold">{copy.welcome}</h1>
        {preview.inviter_name && <p className="text-sm">{copy.invitedBy} <strong>{preview.inviter_name}</strong></p>}
        <p className="text-sm">{copy.welcomeHint}</p><p className="text-xs text-muted-foreground">{copy.noEmail}</p>
      </section>
      <form onSubmit={activate} className="space-y-4" aria-busy={busy}>
        <label className="block space-y-1 text-sm font-medium" htmlFor={id + '-name'}>{copy.displayName}<Input id={id + '-name'} value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} disabled={busy} className="min-h-12 text-base" /></label>
        <div className="space-y-1"><label className="block text-sm font-medium" htmlFor={id + '-username'}>{copy.username}</label><Input id={id + '-username'} value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={21} disabled={busy} aria-describedby={id + '-username-hint'} className="min-h-12 text-base" placeholder="@nome" /><span id={id + '-username-hint'} className="block text-xs font-normal text-muted-foreground">{copy.usernameHint}</span></div>
        <div className="space-y-1"><label htmlFor={id + '-password'} className="text-sm font-medium">{copy.password}</label><div className="relative"><Input id={id + '-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required minLength={12} maxLength={72} disabled={busy} aria-describedby={id + '-password-hint'} className="min-h-12 pr-12 text-base" /><button type="button" aria-label={showPassword ? copy.hidePassword : copy.showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div><p id={id + '-password-hint'} className="text-xs text-muted-foreground">{copy.passwordHint}</p></div>
        {preview.mode === 'phone' && <section className="space-y-3 rounded-xl border p-4"><p className="text-sm">{copy.otpDestination} <strong>{preview.masked_phone}</strong>.</p>
          <Button type="button" variant="outline" className="min-h-11 w-full" disabled={busy || remaining > 0} onClick={() => void requestOtp()}>{remaining > 0 ? `${copy.wait} ${remaining} ${copy.seconds}` : otpRequested ? copy.requestAgain : copy.requestOtp}</Button>
          <label className="block space-y-1 text-sm font-medium" htmlFor={id + '-otp'}>{copy.otp}<Input id={id + '-otp'} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} required disabled={busy} className="min-h-12 text-center font-mono text-xl tracking-widest" /></label>
        </section>}
        <label className="flex cursor-pointer items-start gap-3 py-2 text-sm"><input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} disabled={busy} required className="mt-1 h-5 w-5 shrink-0 accent-primary" /><span>{copy.termsBefore} <Link to={'/terms?lang=' + trustedInviteLanguage(locale)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{copy.terms}</Link> {copy.termsAnd} <Link to={'/privacy?lang=' + trustedInviteLanguage(locale)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{copy.privacy}</Link>.</span></label>
        <p role="status" aria-live="polite" className="text-sm">{message}</p>
        <Button type="submit" disabled={busy || !validFields || (preview.mode === 'phone' && otp.length !== 6)} className="min-h-12 w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{busy ? copy.activating : copy.activate}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">{copy.existingAccount} <Link to="/login" className="text-primary underline">{copy.signIn}</Link></p>
    </>}
  </main>;
}
