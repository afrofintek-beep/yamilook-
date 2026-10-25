import { useTranslation } from 'react-i18next';
import PaposLanguageSelector from './PaposLanguageSelector';
import { loginCopy } from './login-copy';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PaposBrand from './PaposBrand';
export default function PaposLogin() {
  const { t, i18n } = useTranslation();
  const language = (i18n.language || 'pt').split('-')[0];
  const copyLanguage = language in loginCopy ? language as keyof typeof loginCopy : 'en';
  const copy = loginCopy[copyLanguage];
  const { user, loading, signIn } = useAuth();
  const location = useLocation(); const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from?.startsWith('/') && !from.startsWith('//') ? from : '/papos';
  if (user && !loading) return <Navigate to={destination} replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const result = await signIn(email.trim(), password);
      if (result.error) { setError(language === 'pt' ? 'Não foi possível entrar. Verifica os teus dados e tenta novamente.' : t('auth.invalidCredentials')); return; }
      navigate(destination, { replace: true });
    } catch { setError(copy.networkError); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen-safe safe-top safe-bottom bg-background flex items-center justify-center px-6 py-10">
    <div className="w-full max-w-sm space-y-6"><PaposLanguageSelector /><PaposBrand /><h1 lang={copyLanguage} className="text-3xl font-bold">{copy.title}</h1>
      {(location.state as { signedOut?: boolean } | null)?.signedOut && <p role="status" className="text-sm text-muted-foreground">{copy.signedOut}</p>}
      <p lang={copyLanguage} className="text-muted-foreground">{copy.description}</p>
      <form onSubmit={submit} className="space-y-4"><div><label htmlFor="papos-email" className="text-sm">{t('auth.email')}</label><Input id="papos-email" autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
        <div><label htmlFor="papos-password" className="text-sm">{t('auth.password')}</label><Input id="papos-password" autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy || loading} className="w-full">{busy ? t('auth.signingIn') : language === 'pt' ? 'Entrar na KOSOLOLA' : `${t('auth.login')} · KOSOLOLA`}</Button>
      </form><a href="https://www.yamilook.com/forgot-password" className="text-primary text-sm block">{language === 'pt' ? 'Recuperar palavra-passe' : t('auth.forgotPassword')}</a>
      <p className="text-sm text-muted-foreground">{t('auth.noAccount')} <a href="https://www.yamilook.com/onboarding" className="text-primary underline"> {copy.invitation}</a>.</p>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><a href="https://www.yamilook.com/terms">{language === 'pt' ? 'Termos' : t('auth.termsOfService')}</a><a href="https://www.yamilook.com/privacy">{language === 'pt' ? 'Privacidade' : t('auth.privacyPolicy')}</a><a href="https://www.yamilook.com/muxi">Yamilook</a></div>
    </div></main>;
}
