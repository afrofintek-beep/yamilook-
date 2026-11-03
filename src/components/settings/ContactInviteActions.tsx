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
export function ContactInviteActions() {
  const brand = useAppSurface() === 'papos' ? 'KOSOLOLA' : 'YAMILOOK';
  const requestId = useRef<string>();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const url = invite ? buildInviteUrl(invite.code) : '';
  const prepare = async (choice: Channel) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setStatus('');
    setChannel(choice);
    try {
      requestId.current ??= crypto.randomUUID();
      const { data, error } = await client.rpc('issue_shareable_user_invitation', { p_request_id: requestId.current });
      if (error || !data?.code || !data.expires_at) throw error ?? new Error('Invalid invitation');
      setInvite(data);
      setStatus(choice === 'qr' ? 'QR pronto. Mostra-o apenas à pessoa que queres convidar.' : 'Convite pronto. Escolhe o contacto na aplicação e confirma o envio.');
    } catch {
      setStatus('Não foi possível preparar o convite. Tenta novamente.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Ligação copiada. Envia-a apenas à pessoa que queres convidar.');
    } catch {
      setStatus('Selecciona a ligação abaixo e copia manualmente.');
    }
  };
  const share = async () => {
    if (!invite) return;
    try {
      // Called directly from a click, without awaiting token creation (iOS activation).
      await navigator.share({ title: `Convite para a ${brand}`, text: invitationMessage('', invite.code, brand), url });
      setStatus('Partilha concluída na aplicação escolhida. A entrega não está confirmada.');
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        setStatus('Não foi possível abrir a partilha. Usa WhatsApp, email ou copia a ligação.');
      }
    }
  };
  return <section className="mt-6 space-y-3" aria-label="Convidar contactos do telemóvel">
    <p className="text-sm text-muted-foreground">Não precisas de saber o email. Escolhe a pessoa nos contactos do WhatsApp ou da aplicação de email.</p>
    {!invite ? <>
      <Button className="w-full" disabled={pending} onClick={() => void prepare('whatsapp')}><MessageCircle className="mr-2 h-4 w-4" />Convidar pelo WhatsApp</Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => void prepare('email')}><Mail className="mr-2 h-4 w-4" />Convidar por email</Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => void prepare('copy')}><Copy className="mr-2 h-4 w-4" />Criar ligação de convite</Button>
      <Button variant="outline" className="w-full" disabled={pending} onClick={() => void prepare('qr')}><QrCode className="mr-2 h-4 w-4" />Gerar QR individual</Button>
      {pending && <p role="status">A preparar convite…</p>}
    </> : <>
      <Button variant="outline" className="w-full" onClick={() => setChannel('qr')}><QrCode className="mr-2 h-4 w-4" />Mostrar QR individual</Button>
      {channel === 'qr' && <figure className="space-y-3 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-background p-4 text-center" aria-label="Convite individual por QR code">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Convite pessoal · {brand}</p>
        <h3 className="text-xl font-bold">A nossa comunidade começa contigo.</h3>
        <div className="mx-auto w-fit max-w-full rounded-lg bg-white p-4"><QRCodeSVG value={url} size={240} level="H" marginSize={4} imageSettings={{ src: brand === 'KOSOLOLA' ? '/papos-app/kosolola-icon-192.png' : '/yamilook-logo.png', width: 44, height: brand === 'KOSOLOLA' ? 44 : 30, excavate: true }} title="Convite individual" style={{ maxWidth: '100%', height: 'auto' }} /></div>
        <figcaption className="text-sm text-muted-foreground">Aponta a câmara. Junta-te à {brand}.<span className="mt-1 block text-xs">Este convite é só para ti. Uma pessoa, uma adesão.</span></figcaption>
      </figure>}
      <Button variant={channel === 'whatsapp' ? 'default' : 'outline'} className="w-full" asChild><a href={buildWhatsAppInviteUrl('', invite.code, brand)} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Escolher contacto no WhatsApp</a></Button>
      <Button variant={channel === 'email' ? 'default' : 'outline'} className="w-full" asChild><a href={buildEmailInviteDraftUrl('', invite.code, brand)}><Mail className="mr-2 h-4 w-4" />Escolher contacto no email</a></Button>
      {typeof navigator.share === 'function' && <Button variant="outline" className="w-full" onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" />Partilhar pelo telemóvel</Button>}
      <Button variant={channel === 'copy' ? 'default' : 'outline'} className="w-full" onClick={() => void copy()}><Copy className="mr-2 h-4 w-4" />Copiar ligação</Button>
      <label className="block text-sm" htmlFor="contact-invite-link">Ligação para o teu contacto</label>
      <Input id="contact-invite-link" value={url} readOnly onFocus={event => event.target.select()} />
      <p className="text-xs text-muted-foreground">Válido até {new Date(invite.expires_at).toLocaleDateString()}. Uma pessoa por convite. Quem receber a ligação pode utilizá-la; partilha-a apenas com o destinatário.</p>
      <Button variant="ghost" className="w-full" onClick={() => { requestId.current = undefined; setInvite(null); setStatus(''); }}>Convidar outra pessoa</Button>
    </>}
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
  </section>;
}
