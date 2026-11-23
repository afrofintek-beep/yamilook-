import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useUiLocale } from '@/i18n/ui-copy';
import {
  isRecoveryCodeValid,
  isTrustedPasswordValid,
  isTrustedUsername,
  recoverTrustedAccount,
} from '@/lib/trusted-account-login';
import { TrustedInvitationError, trustedInviteLanguage } from './api';
import { trustedAccountCopy } from './account-copy';

/** Recovery material stays in component memory and is never persisted or logged. */
export function TrustedAccountRecovery() {
  const locale = useUiLocale();
  const copy = trustedAccountCopy(locale);
  const language = trustedInviteLanguage(locale);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!isTrustedUsername(username) || !isRecoveryCodeValid(recoveryCode)) {
      setError(copy.invalidRecovery);
      return;
    }
    if (!isTrustedPasswordValid(password)) {
      setError(copy.passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.passwordsDiffer);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await recoverTrustedAccount(username, recoveryCode, password);
      setRecoveryCode('');
      setPassword('');
      setConfirmPassword('');
      setNewCode(result.recovery_code);
    } catch (cause) {
      const code = cause instanceof TrustedInvitationError ? cause.code : 'unavailable';
      setError(code === 'rate_limited' ? copy.rateLimited
        : code === 'invalid_recovery' || code === 'invalid_username' ? copy.invalidRecovery
        : code === 'weak_password' ? copy.passwordError : copy.unavailable);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const copyNewCode = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(newCode);
      setCopyStatus(copy.copied);
    } catch {
      setCopyStatus(copy.copyFailed);
    }
  };

  if (newCode) {
    return <section lang={language} aria-labelledby="trusted-recovery-success" className="space-y-5">
      <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden="true" />
      <h2 id="trusted-recovery-success" className="text-xl font-semibold">{copy.successTitle}</h2>
      <p className="text-sm text-muted-foreground">{copy.successDescription}</p>
      <div className="space-y-2">
        <Label htmlFor="trusted-new-recovery-code">{copy.newCode}</Label>
        <textarea
          id="trusted-new-recovery-code"
          className="w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-sm break-all"
          readOnly value={newCode} rows={3} autoComplete="off" spellCheck={false}
          onFocus={event => event.currentTarget.select()}
        />
        <Button type="button" variant="outline" onClick={copyNewCode} className="w-full gap-2">
          <Copy className="h-4 w-4" aria-hidden="true" />{copy.copy}
        </Button>
        {copyStatus && <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>}
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="trusted-recovery-saved" checked={saved} onCheckedChange={value => setSaved(value === true)} className="mt-0.5" />
        <Label htmlFor="trusted-recovery-saved" className="text-sm leading-relaxed">{copy.saved}</Label>
      </div>
      <Button type="button" className="w-full" disabled={!saved} onClick={() => {
        setNewCode('');
        navigate(`/login?lang=${encodeURIComponent(locale)}`, { replace: true });
      }}>{copy.backToLogin}</Button>
    </section>;
  }

  return <section lang={language} aria-labelledby="trusted-recovery-title" className="space-y-4">
    <div className="space-y-2">
      <h2 id="trusted-recovery-title" className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" aria-hidden="true" />{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
    </div>
    <form onSubmit={submit} className="space-y-4" noValidate aria-busy={busy}>
      <div className="space-y-2">
        <Label htmlFor="trusted-recovery-username">{copy.username}</Label>
        <Input id="trusted-recovery-username" value={username} onChange={event => setUsername(event.target.value)}
          autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={21} required disabled={busy} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="trusted-recovery-code">{copy.recoveryCode}</Label>
        <Input id="trusted-recovery-code" value={recoveryCode} onChange={event => setRecoveryCode(event.target.value)}
          type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={160} required disabled={busy}
          aria-describedby="trusted-recovery-code-hint" />
        <p id="trusted-recovery-code-hint" className="text-xs text-muted-foreground">{copy.recoveryHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="trusted-recovery-password">{copy.newPassword}</Label>
        <Input id="trusted-recovery-password" value={password} onChange={event => setPassword(event.target.value)}
          type="password" autoComplete="new-password" maxLength={72} required disabled={busy}
          aria-describedby="trusted-recovery-password-hint" />
        <p id="trusted-recovery-password-hint" className="text-xs text-muted-foreground">{copy.passwordHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="trusted-recovery-confirm">{copy.confirmPassword}</Label>
        <Input id="trusted-recovery-confirm" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}
          type="password" autoComplete="new-password" maxLength={72} required disabled={busy} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full gap-2" disabled={busy || !username || !recoveryCode || !password || !confirmPassword}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? copy.submitting : copy.submit}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.codeMissing}</p>
    </form>
  </section>;
}
