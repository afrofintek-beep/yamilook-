import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { campaignClient, campaignError, campaignStateLabels, canIssueCampaign, type InvitationCampaign, type CampaignReport } from '@/lib/invitation-campaigns';
import { buildInviteUrl } from '@/lib/referral';
import { buildWhatsAppInviteUrl, buildEmailInviteDraftUrl } from '@/lib/invite-delivery';
import { useAppSurface } from '@/lib/app-surface';

export function CampaignInvites() {
  useUiLocale();
  const brand = useAppSurface() === 'papos' ? 'KOSOLOLA' : 'YAMILOOK';
  const [campaigns, setCampaigns] = useState<InvitationCampaign[]>([]);
  const [selected, setSelected] = useState('');
  const [email, setEmail] = useState('');
  const [report, setReport] = useState<CampaignReport>();
  const [offset, setOffset] = useState(0);
  const [invite, setInvite] = useState<{ code: string; expires_at: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('A consultar campanhas…');
  const request = useRef<{ key: string; id: string }>();
  const issuing = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const refresh = useCallback(async () => {
    const result = await campaignClient.rpc('list_invitation_campaigns', {});
    if (result.error) throw result.error;
    setCampaigns(result.data ?? []);
  }, []);
  useEffect(() => { void refresh().then(() => setMessage('')).catch(e => setMessage(campaignError(e))); }, [refresh]);
  useEffect(() => {
    setReport(undefined);
    if (!selected) return;
    let active = true;
    void campaignClient.rpc('campaign_report', { p_campaign: selected, p_offset: offset }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(campaignError(error)); else if (data) setReport(data);
    });
    return () => { active = false; };
  }, [selected, offset, invite]);
  const campaign = campaigns.find(c => c.id === selected);
  const issue = async () => {
    if (!campaign || !canIssueCampaign(campaign) || issuing.current) return;
    issuing.current = true; setBusy(true); setMessage('');
    const version = generation.current;
    const normalizedEmail = email.trim().toLowerCase() || null;
    const key = `${selected}:${normalizedEmail ?? ''}`;
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      const { data, error } = await campaignClient.rpc('issue_campaign_invitation', {
        p_campaign: selected, p_request_id: request.current.id, p_email: normalizedEmail,
      });
      if (error) throw error;
      if (!data?.code) throw new Error(uiText("Invalid response"));
      if (generation.current === version) { setInvite(data); setMessage(uiText("Convite emitido. Partilha-o apenas com uma pessoa.")); }
    } catch (error) { if (generation.current === version) setMessage(campaignError(error)); }
    finally {
      if (generation.current === version) {
        await refresh().catch(() => {});
        setBusy(false);
      }
      issuing.current = false;
    }
  };
  return <section className="space-y-4 mt-6" aria-label={uiText("Convites por campanha")}>
    <h3 className="font-semibold">{uiText("Campanhas de convites")}</h3>
    <p className="text-sm text-muted-foreground">{uiText("A participação depende de autorização e presença verificada. Convites expirados também contam para o limite.")}</p>
    {campaigns.length === 0 && <p>{uiText("Não tens campanhas atribuídas.")}</p>}
    <label className="block">{uiText("Campanha")}<select className="w-full rounded-md border bg-background p-2" value={selected} disabled={busy} onChange={e => {
        generation.current++; setSelected(e.target.value); setInvite(undefined); setOffset(0); request.current = undefined; setMessage('');
      }}><option value="">{uiText("Selecionar campanha")}</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name} — {campaignStateLabels[c.status]}</option>)}</select>
    </label>
    {campaign && <>
      <p>{campaign.my_issued}{uiText(" de ")}{campaign.max_per_user}{uiText(" convites emitidos. ")}{Math.max(0, campaign.max_per_user - campaign.my_issued)}{uiText(" restantes.")}</p>
      <p className="text-sm">{uiText("Até ")}{new Date(campaign.ends_at).toLocaleString()}.</p>
      {!canIssueCampaign(campaign) && <p role="note">{uiText("Emissão indisponível: verifica a autorização, as condições, o período e os limites da campanha.")}</p>}
      {!invite ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void issue(); }}>
        <label className="block" htmlFor="campaign-recipient">{uiText("Email do convidado (opcional)")}</label>
        <Input id="campaign-recipient" type="email" maxLength={254} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} />
        <p className="text-xs text-muted-foreground">{uiText("Sem email, a primeira pessoa que usar a ligação fica com o convite.")}</p>
        <Button disabled={busy || !canIssueCampaign(campaign)} type="submit">{busy ? uiText("A emitir…") : uiText("Emitir convite da campanha")}</Button>
      </form> : <div className="space-y-3">
        <label htmlFor="campaign-link">{uiText("Ligação individual")}</label>
        <Input id="campaign-link" readOnly value={buildInviteUrl(invite.code)} onFocus={e => e.target.select()} />
        <p>{uiText("Válido até ")}{new Date(invite.expires_at).toLocaleString()}.</p>
        <Button asChild><a href={buildWhatsAppInviteUrl(email.trim(), invite.code, brand, invite.expires_at)} target="_blank" rel="noopener noreferrer">{uiText("Partilhar no WhatsApp")}</a></Button>
        <Button variant="outline" asChild><a href={buildEmailInviteDraftUrl(email.trim(), invite.code, brand, invite.expires_at)}>{uiText("Preparar email")}</a></Button>
        <Button variant="ghost" onClick={() => { setInvite(undefined); setEmail(''); request.current = undefined; }}>{uiText("Novo destinatário")}</Button>
      </div>}
      {report && <div className="space-y-2">
        <p>{report.issued}{uiText(" emitidos · ")}{report.used}{uiText(" utilizados · ")}{report.expired}{uiText(" expirados · ")}{report.pending}{uiText(" pendentes")}</p>
        {report.invitations.map(i => <div key={i.code} className="text-sm border-b py-2 break-all">{i.recipient_email || uiText("Ligação individual")} · {{ used: 'Utilizado', expired: 'Expirado', pending: 'Pendente' }[i.state]}
          {i.state === 'pending' && <Button variant="link" onClick={() => { setEmail(i.recipient_email ?? ''); setInvite(i); }}>{uiText("Ver ligação")}</Button>}
        </div>)}
        <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))}>{uiText("Anteriores")}</Button>
        <Button variant="outline" disabled={offset + 50 >= report.issued} onClick={() => setOffset(n => n + 50)}>{uiText("Seguintes")}</Button>
      </div>}
    </>}
    <p role="status">{message}</p>
    <Button variant="ghost" disabled={busy} onClick={() => void refresh().catch(e => setMessage(campaignError(e)))}>{uiText("Atualizar campanhas")}</Button>
  </section>;
}
