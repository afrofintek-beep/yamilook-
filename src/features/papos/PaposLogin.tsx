import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PaposBrand from './PaposBrand';
export default function PaposLogin() {
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
      if (result.error) { setError('Não foi possível entrar. Verifica o email e a palavra-passe da tua conta Yamilook.'); return; }
      navigate(destination, { replace: true });
    } catch { setError('Não foi possível ligar. Verifica a ligação e tenta novamente.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen-safe safe-top safe-bottom bg-background flex items-center justify-center px-6 py-10">
    <div className="w-full max-w-sm space-y-6"><PaposBrand /><h1 className="text-3xl font-bold">A conversa continua aqui.</h1>
      {(location.state as { signedOut?: boolean } | null)?.signedOut && <p role="status" className="text-sm text-muted-foreground">Sessão terminada. Entra novamente para aceder às tuas conversas.</p>}
      <p className="text-muted-foreground">Entra com a tua conta Yamilook. As tuas conversas e contactos acompanham-te. A entrada na KOSOLOLA é independente neste dispositivo.</p>
      <form onSubmit={submit} className="space-y-4"><div><label htmlFor="papos-email" className="text-sm">Email</label><Input id="papos-email" autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></div>
        <div><label htmlFor="papos-password" className="text-sm">Palavra-passe</label><Input id="papos-password" autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy || loading} className="w-full">{busy ? 'A entrar…' : 'Entrar na KOSOLOLA'}</Button>
      </form><a href="https://www.yamilook.com/forgot-password" className="text-primary text-sm block">Recuperar palavra-passe</a>
      <p className="text-sm text-muted-foreground">Ainda não tens conta? <a href="https://www.yamilook.com/onboarding" className="text-primary underline">Criar conta Yamilook com convite</a>.</p>
      <div className="flex gap-4 text-xs text-muted-foreground"><a href="https://www.yamilook.com/terms">Termos</a><a href="https://www.yamilook.com/privacy">Privacidade</a><a href="https://www.yamilook.com/muxi">Yamilook</a></div>
    </div></main>;
}
