import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Radio, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';

export interface LiveAccessInfo {
  exists: boolean;
  host_name?: string;
  title?: string;
  has_access?: boolean;
  request_status?: string | null;
  status?: string;
}

/** Shown to a user who lacks access to a banda-restricted live: request to
 *  enter, wait for the host, and join once approved (realtime). */
export function LiveAccessRequest({
  sessionId,
  info,
  onGranted,
}: {
  sessionId: string;
  info: LiveAccessInfo;
  onGranted: () => void;
}) {
  useUiLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(info.request_status ?? null);
  const [sending, setSending] = useState(false);

  // Watch my own access row — when the host approves, retry the join.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`live-access-${sessionId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_access', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { user_id: string; status: string } | undefined;
          if (row && row.user_id === user.id) {
            setStatus(row.status);
            if (row.status === 'approved') onGranted();
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, user, onGranted]);

  const request = async () => {
    if (!user) return;
    setSending(true);
    const { error } = await supabase.from('live_access').insert({ session_id: sessionId, user_id: user.id, status: 'pending' });
    setSending(false);
    if (error && !/duplicate|unique/i.test(error.message)) {
      toast.error(uiText("Não foi possível enviar o pedido."));
      return;
    }
    setStatus("pending");
    toast.success(uiText("Pedido enviado. À espera da autorização do dono."));
  };

  // Convidado aceita o convite → passa a aprovado e entra.
  const accept = async () => {
    if (!user) return;
    setSending(true);
    const { data, error } = await supabase.rpc('live_accept_invite', { p_session: sessionId });
    setSending(false);
    if (error || !(data as { ok?: boolean })?.ok) { toast.error(uiText("Não foi possível aceitar o convite.")); return; }
    setStatus("approved");
    onGranted();
  };

  const decline = async () => {
    if (!user) return;
    await supabase.rpc('live_decline_invite', { p_session: sessionId });
    navigate(-1);
  };

  const invited = status === 'invited';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 text-center gap-5 safe-top">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-foreground">{invited ? uiText("Convite para a live") : uiText("Live da banda")}</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          {invited
            ? uiText('{{host}} convidou-te para esta live. Aceita para entrar.', { host: info.host_name ?? uiText('O anfitrião') })
            : info.host_name
              ? uiText('{{host}} está ao vivo para a banda. Não fazes parte, mas podes pedir para entrar.', { host: info.host_name })
              : uiText('Esta live é da banda. Não fazes parte, mas podes pedir para entrar.')}
        </p>
      </div>

      {status === 'approved' ? (
        <Button className="rounded-full px-6" onClick={onGranted}>
          <Radio className="w-4 h-4 mr-2" />{uiText(" Entrar na live")}</Button>
      ) : invited ? (
        <div className="flex flex-col items-center gap-2">
          <Button className="rounded-full px-6 bg-amber-400 text-black hover:bg-amber-500" onClick={accept} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Radio className="w-4 h-4 mr-2" />{uiText(" Aceitar e entrar")}</>}
          </Button>
          <button className="text-xs text-muted-foreground" onClick={decline}>{uiText("Recusar")}</button>
        </div>
      ) : status === 'pending' ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />{uiText(" À espera da autorização do dono…")}</div>
      ) : status === 'denied' ? (
        <p className="text-sm text-destructive">{uiText("O dono não autorizou a tua entrada.")}</p>
      ) : (
        <Button className="rounded-full px-6" onClick={request} disabled={sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : uiText("Pedir para entrar")}
        </Button>
      )}

      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />{uiText(" Voltar")}</Button>
    </div>
  );
}
