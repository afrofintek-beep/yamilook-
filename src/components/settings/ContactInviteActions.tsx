import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';
import { useAppSurface } from '@/lib/app-surface';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Copy, Mail, MessageCircle, Share2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { buildInviteUrl } from '@/lib/referral';
import { buildEmailInviteDraftUrl, buildWhatsAppInviteUrl, invitationMessage } from '@/lib/invite-delivery';

type Channel = 'whatsapp' | 'email' | 'copy' | 'qr';
const client = supabase as unknown as SupabaseClient<{
  public: { Tables: {}; Views: {}; Functions: {
    issue_shareable_user_invitation: { Args: { p_request_id: string }; Returns: { code: string; expires_at: string } };
  }; Enums: {}; CompositeTypes: {} };
}>;

/** A fresh instance is mounted per sheet opening/account; retries reuse the request ID. */
export function ContactInviteActions({ language = uiLocale() }: { language?: string }) {
  useUiLocale();
  const brand = useAppSurface() === 'papos' ? 'KOSOLOLA' : 'YAMILOOK';
  const requestId = useRef<string>();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const url = invite ? buildInviteUrl(invite.code, language) : '';
  const prepare = async (choice: Channel) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setStatus('');
    setChannel(choice);
    try {
      requestId.current ??= crypto.randomUUID();
      const { data, error } = await client.rpc('issue_shareable_user_invitation', { p_request_id: requestId.current });
      if (error || !data?.code || !data.expires_at) throw error ?? new Error(uiText("Invalid invitation"));
      setInvite(data);
      setStatus(choice === 'qr' ? uiText("QR pronto. Mostra-o apenas à pessoa que queres convidar.") : uiText("Convite pronto. Escolhe o contacto na aplicação e confirma o envio."));
    } catch {
      setStatus(uiText("Não foi possível preparar o convite. Tenta novamente."));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(uiText("Ligação copiada. Envia-a apenas à pessoa que queres convidar."));
    } catch {
      setStatus(uiText("Selecciona a ligação abaixo e copia manualmente."));
    }
  };
  const share = async () => {
    if (!invite) return;
    try {
      // Called directly from a click, without awaiting token creation (iOS activation).
      await navigator.share({ title: uiText("Convite para a {{value1}}", { value1: brand }, language), text: invitationMessage('', invite.code, brand, invite.expires_at, language), url });
      setStatus(uiText("Partilha concluída na aplicação escolhida. A entrega não está confirmada."));
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        setStatus(uiText("Não foi possível abrir a partilha. Usa WhatsApp, email ou copia a ligação."));
      }
    }
  };
  return <section className="mt-6 space-y-3" aria-label={uiText("Convidar contactos do telemóvel")}>
    <p className="text-sm text-muted-foreground">{uiText("Não precisas de saber o email. Escolhe a pessoa nos contactos do WhatsApp ou da aplicação de email.")}</p>
    {!invite ? <>
      <Button className="w-full" disabled={pending} onClick={() => void prepare('whatsapp')}><MessageCircle className="mr-2 h-4 w-4" />{uiText("Convidar pelo WhatsApp")}</Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => void prepare('email')}><Mail className="mr-2 h-4 w-4" />{uiText("Convidar por email")}</Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => void prepare('copy')}><Copy className="mr-2 h-4 w-4" />{uiText("Criar ligação de convite")}</Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => void prepare('qr')}><QrCode className="mr-2 h-4 w-4" />{uiText("Gerar QR individual")}</Button>
      {pending && <p role="status">{uiText("A preparar convite…")}</p>}
    </> : <>
      <Button variant="outline" className="w-full" onClick={() => setChannel('qr')}><QrCode className="mr-2 h-4 w-4" />{uiText("Mostrar QR individual")}</Button>
      {channel === 'qr' && <figure className="space-y-2 text-center" aria-label={uiText("Convite individual por QR code")}>
        <div className="mx-auto w-fit max-w-full rounded-lg bg-white p-4"><QRCodeSVG value={url} size={240} level="M" marginSize={4} title={uiText("Convite individual")} style={{ maxWidth: '100%', height: 'auto' }} /></div>
        <figcaption className="text-sm text-muted-foreground">{uiText("Lê com a câmara para te registares. Válido para uma pessoa; só fica utilizado após o registo bem-sucedido.")}</figcaption>
      </figure>}
      <Button variant={channel === 'whatsapp' ? 'default' : 'outline'} className="w-full" asChild><a href={buildWhatsAppInviteUrl('', invite.code, brand, invite.expires_at, language)} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />{uiText("Escolher contacto no WhatsApp")}</a></Button>
      <Button variant={channel === 'email' ? 'default' : 'outline'} className="w-full" asChild><a href={buildEmailInviteDraftUrl('', invite.code, brand, invite.expires_at, language)}><Mail className="mr-2 h-4 w-4" />{uiText("Escolher contacto no email")}</a></Button>
      {typeof navigator.share === 'function' && <Button variant="outline" className="w-full" onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" />{uiText("Partilhar pelo telemóvel")}</Button>}
      <Button variant={channel === 'copy' ? 'default' : 'outline'} className="w-full" onClick={() => void copy()}><Copy className="mr-2 h-4 w-4" />{uiText("Copiar ligação")}</Button>
      <label className="block text-sm" htmlFor="contact-invite-link">{uiText("Ligação para o teu contacto")}</label>
      <Input id="contact-invite-link" value={url} readOnly onFocus={event => event.target.select()} />
      <p className="text-xs text-muted-foreground">{uiText("Válido até {{value1}}. Uma pessoa por convite. Quem receber a ligação pode utilizá-la; partilha-a apenas com o destinatário.", { value1: (new Date(invite.expires_at).toLocaleDateString(uiLocale())) ?? "" })}</p>
      <Button variant="ghost" className="w-full" onClick={() => { requestId.current = undefined; setInvite(null); setStatus(''); }}>{uiText("Convidar outra pessoa")}</Button>
    </>}
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
  </section>;
}
