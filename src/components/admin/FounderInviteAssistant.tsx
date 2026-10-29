import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { buildInviteUrl } from '@/lib/referral';
import { buildFounderInviteMessage, type FounderInviteLanguage } from '@/lib/founder-invite';

type IssueResult = { code?: string };

export function FounderInviteAssistant() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [reason, setReason] = useState('');
  const [language, setLanguage] = useState<FounderInviteLanguage>('pt');
  const [link, setLink] = useState('');
  const [issuedEmail, setIssuedEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [customMessage, setCustomMessage] = useState<string | null>(null);

  const draft = buildFounderInviteMessage({ name, profession, reason, language, link });
  const message = customMessage ?? draft;
  const change = (update: () => void) => { update(); setCustomMessage(null); };
  const updateEmail = (value: string) => { setEmail(value); setLink(''); setIssuedEmail(''); setStatus(''); setCustomMessage(null); };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setStatus('Copiado. Envia pessoalmente no canal escolhido.'); }
    catch { setStatus('Não foi possível copiar. Selecciona e copia o texto manualmente.'); }
  };
  const issue = async () => {
    const address = email.trim().toLowerCase();
    if (!address || busy) return;
    setBusy(true);
    setStatus('');
    try {
      // The existing RPC verifies invitation permissions on the server.
      // Never generate a code on the client or bypass its single-use/email binding.
      const { data, error } = await supabase.rpc('issue_user_invitation' as never, { p_email: address } as never);
      if (error) throw error;
      const code = (data as IssueResult | null)?.code;
      if (!code) throw new Error('Não foi possível gerar o convite.');
      setLink(buildInviteUrl(code));
      setIssuedEmail(address);
      setCustomMessage(null);
      setStatus('Convite individual criado. Confirma o destinatário antes de partilhar.');
    } catch {
      setStatus('Não foi possível criar o convite. Confirma a autorização de convites e o endereço de email.');
    } finally { setBusy(false); }
  };

  return <Card>
    <CardHeader>
      <CardTitle>Assistente de Convites do Fundador</CardTitle>
      <CardDescription>Founding Circle — prepara uma mensagem pessoal, revê-a e partilha-a manualmente. A ligação individual exige o email de registo do convidado.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Nome do convidado
          <Input value={name} maxLength={100} onChange={e => change(() => setName(e.target.value))} placeholder="Primeiro nome" />
        </label>
        <label className="space-y-1 text-sm font-medium">Email de registo (para emitir o convite)
          <Input value={email} type="email" autoCapitalize="none" maxLength={254} onChange={e => updateEmail(e.target.value)} placeholder="nome@exemplo.com" />
        </label>
        <label className="space-y-1 text-sm font-medium">Profissão ou área
          <Input value={profession} maxLength={120} onChange={e => change(() => setProfession(e.target.value))} placeholder="Empreendedorismo, ensino..." />
        </label>
        <label className="space-y-1 text-sm font-medium">Idioma
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm" value={language} onChange={e => change(() => setLanguage(e.target.value as FounderInviteLanguage))}>
            <option value="pt">Português</option><option value="en">English</option><option value="fr">Français</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-sm font-medium">Porque escolheste esta pessoa?
        <Input value={reason} maxLength={240} onChange={e => change(() => setReason(e.target.value))} placeholder="A experiência dela em mentoria..." />
      </label>
      <label className="block space-y-1 text-sm font-medium">Mensagem pessoal — podes editar antes de copiar
        <textarea aria-label="Mensagem pessoal" className="min-h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm" value={message} onChange={e => setCustomMessage(e.target.value)} />
      </label>
      {link && <div className="space-y-1 text-sm">
        <p className="font-medium">Convite reservado ao email {issuedEmail}</p>
        <Input aria-label="Ligação de convite" readOnly value={link} onFocus={e => e.target.select()} />
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void copy(message)}>Copiar mensagem</Button>
        <Button type="button" variant="outline" disabled={!email.trim() || busy || !!link} onClick={() => void issue()}>{busy ? 'A gerar…' : 'Gerar convite individual'}</Button>
        {link && <Button type="button" variant="outline" onClick={() => void copy(link)}>Copiar ligação</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Não envia mensagens automaticamente pelo LinkedIn, WhatsApp ou email. A emissão exige permissão no servidor. O email indicado deve coincidir com o utilizado no registo; um convite emitido não pode ser reutilizado.</p>
      <p role="status" className="text-sm text-muted-foreground">{status}</p>
    </CardContent>
  </Card>;
}
