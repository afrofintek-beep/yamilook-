import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { buildInviteUrl } from '@/lib/referral';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SharedLink = {
  id: string; code: string; name: string; max_uses: number; uses_count: number;
  confirmed_count: number; status: 'active' | 'suspended'; expires_at: string;
};

export function SharedRegistrationLinks() {
  const locale = useUiLocale();
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const load = useCallback(async (id?: string, status?: SharedLink['status']) => {
    setBusy(true);
    setError(false);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_registration_links' as never,
        { p_link: id ?? null, p_status: status ?? null } as never);
      if (rpcError) throw rpcError;
      setLinks((data ?? []) as unknown as SharedLink[]);
    } catch { setError(true); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const copy = async (link: SharedLink) => {
    try { await navigator.clipboard.writeText(buildInviteUrl(link.code)); setCopied(link.id); }
    catch { setError(true); }
  };

  return <Card id="convites-coletivos">
    <CardHeader>
      <CardTitle>{uiText('Convites coletivos')}</CardTitle>
      <CardDescription>{uiText('Uma ligação para várias pessoas, com limite de inscrições e prazo de validade.')}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Button variant="outline" disabled={busy} onClick={() => void load()}>{uiText('Atualizar')}</Button>
      {error && <p role="alert">{uiText('Não foi possível atualizar os convites. Tenta novamente.')}</p>}
      {!busy && !error && links.length === 0 && <p>{uiText('Ainda não existem convites coletivos.')}</p>}
      {links.map(link => {
        const expired = new Date(link.expires_at).getTime() <= Date.now();
        const full = link.uses_count >= link.max_uses;
        return <section key={link.id} className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold break-words">{link.name}</h3>
          <p>{uiText('Inscrições: {{used}} de {{limit}} · Emails confirmados: {{confirmed}}', {
            used: link.uses_count, limit: link.max_uses, confirmed: link.confirmed_count,
          })}</p>
          <p>{uiText('Válido até {{date}}', { date: new Date(link.expires_at).toLocaleString(locale) })}</p>
          <p>{expired ? uiText('Expirado') : full ? uiText('Limite atingido') : link.status === 'active' ? uiText('Ativo') : uiText('Suspenso')}</p>
          <Input aria-label={uiText('Link de convite')} value={buildInviteUrl(link.code)} readOnly onFocus={event => event.target.select()} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy(link)}>{copied === link.id ? uiText('Copiado!') : uiText('Copiar link')}</Button>
            <Button disabled={busy || expired || full} variant={link.status === 'active' ? 'destructive' : 'outline'}
              onClick={() => void load(link.id, link.status === 'active' ? 'suspended' : 'active')}>
              {link.status === 'active' ? uiText('Suspender') : uiText('Retomar')}
            </Button>
          </div>
        </section>;
      })}
      <p className="text-xs text-muted-foreground">{uiText('Cada conta criada ocupa uma vaga, mesmo antes da confirmação do email. Reencaminhar a ligação permite que outras pessoas utilizem as vagas disponíveis.')}</p>
    </CardContent>
  </Card>;
}
