import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useEffect, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldAlert, Copy } from 'lucide-react';

type View = 'loading' | 'disabled' | 'enrolling' | 'enabled';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

// Two-factor auth (TOTP — Google Authenticator, Authy, etc.) via Supabase's
// native MFA. enroll → show QR → verify a 6-digit code → factor is active.
export function TwoFactorSheet({ open, onOpenChange }: Props) {
  useUiLocale();
  const { user } = useAuth();
  const [view, setView] = useState<View>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const syncProfileFlag = useCallback(async (enabled: boolean) => {
    if (user) await supabase.from('profiles').update({ two_factor_enabled: enabled }).eq('id', user.id);
  }, [user]);

  const refresh = useCallback(async () => {
    setView('loading');
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setView('disabled'); return; }
    const verified = data?.totp?.find((f) => f.status === 'verified');
    if (verified) {
      setFactorId(verified.id);
      setView('enabled');
    } else {
      setView('disabled');
    }
  }, []);

  useEffect(() => {
    if (open) { setCode(''); setQr(null); setSecret(null); refresh(); }
  }, [open, refresh]);

  const startEnroll = async () => {
    setBusy(true);
    // Clean up any leftover unverified factors so enroll doesn't clash on name.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `yamilook-${user?.id?.slice(0, 8) ?? 'totp'}`,
    });
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? 'Não foi possível iniciar o 2FA.'); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setView('enrolling');
  };

  const verify = async () => {
    if (!factorId || code.length < 6) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) { setBusy(false); toast.error(uiText("Falha ao verificar. Tenta de novo.")); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) { toast.error(uiText("Código inválido. Confirma no teu app.")); return; }
    await syncProfileFlag(true);
    toast.success(uiText("Autenticação de dois fatores ativada. 🔒"));
    setCode(''); setQr(null); setSecret(null);
    setView('enabled');
  };

  const disable = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { toast.error(uiText("Não foi possível desativar.")); return; }
    await syncProfileFlag(false);
    toast.success(uiText("Autenticação de dois fatores desativada."));
    setView('disabled');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />{uiText(" Autenticação de dois fatores")}</SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {view === 'loading' && (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}

          {view === 'disabled' && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">{uiText("Adiciona uma camada extra de segurança. Com o 2FA ativo, além da palavra-passe precisas de um código de 6 dígitos de uma app como o ")}<b>{uiText("Google Authenticator")}</b>{uiText(" ou ")}<b>{uiText("Authy")}</b>.
              </p>
              <Button className="w-full h-11 rounded-xl" onClick={startEnroll} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : uiText("Ativar 2FA")}
              </Button>
            </>
          )}

          {view === 'enrolling' && (
            <>
              <p className="text-sm text-muted-foreground">{uiText("1. Lê o QR com a tua app de autenticação:")}</p>
              {qr && (
                <div className="flex justify-center">
                  <img src={qr} alt={uiText("QR 2FA")} className="w-48 h-48 rounded-xl bg-white p-2" />
                </div>
              )}
              {secret && (
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(secret); toast.success(uiText("Chave copiada")); }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  <Copy className="h-3.5 w-3.5" /> <span className="font-mono break-all">{secret}</span>
                </button>
              )}
              <p className="text-sm text-muted-foreground">{uiText("2. Escreve o código de 6 dígitos:")}</p>
              <Input
                inputMode="numeric" maxLength={6} placeholder="000000"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-lg tracking-[0.4em] font-mono"
              />
              <Button className="w-full h-11 rounded-xl" onClick={verify} disabled={busy || code.length < 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : uiText("Confirmar e ativar")}
              </Button>
            </>
          )}

          {view === 'enabled' && (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{uiText("2FA ativo")}</p>
                  <p className="text-xs text-muted-foreground">{uiText("A tua conta está protegida com um segundo fator.")}</p>
                </div>
              </div>
              <Button variant="destructive" className="w-full h-11 rounded-xl gap-2" onClick={disable} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldAlert className="h-4 w-4" />{uiText(" Desativar 2FA")}</>}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
