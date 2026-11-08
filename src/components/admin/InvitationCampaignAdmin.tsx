import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { campaignClient, campaignError, campaignStateLabels, type CampaignConfig, type CampaignReport, type InvitationCampaign } from '@/lib/invitation-campaigns';

const initial = (): CampaignConfig => ({ name: '', status: 'draft', starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 7 * 86400000).toISOString(), max_per_user: 10, max_total: 100,
  active_within_days: 30, min_account_days: 7, require_confirmed_email: true, invite_ttl_hours: 168 });
const localDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
};

export function InvitationCampaignAdmin() {
  useUiLocale();
  const [campaigns, setCampaigns] = useState<InvitationCampaign[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [config, setConfig] = useState<CampaignConfig>(initial);
  const [report, setReport] = useState<CampaignReport>();
  const [offset, setOffset] = useState(0);
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reportRequest = useRef(0);
  const refresh = useCallback(async () => {
    const { data, error } = await campaignClient.rpc('list_invitation_campaigns', {});
    if (error) throw error;
    setCampaigns(data ?? []);
  }, []);
  const loadReport = useCallback(async () => {
    const request = ++reportRequest.current;
    if (!selected) return;
    const { data, error } = await campaignClient.rpc('campaign_report', { p_campaign: selected, p_offset: offset });
    if (request !== reportRequest.current) return;
    if (error) throw error;
    if (data) setReport(data);
  }, [selected, offset]);
  useEffect(() => { void refresh().catch(e => setMessage(campaignError(e))); }, [refresh]);
  useEffect(() => { setReport(undefined); void loadReport().catch(e => setMessage(campaignError(e))); }, [loadReport]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); await refresh(); await loadReport(); }
    catch (e) { setMessage(campaignError(e)); }
    finally { setBusy(false); }
  };
  const save = (next: CampaignConfig) => run(async () => {
    const { data, error } = await campaignClient.rpc('save_invitation_campaign', { p_id: selected, p_config: next });
    if (error) throw error;
    setSelected(data); setConfig(next); setMessage(uiText("Campanha guardada."));
  });
  const member = (address: string, allowed: boolean) => run(async () => {
    if (!selected || (allowed && !verified)) return;
    const { error } = await campaignClient.rpc('set_campaign_member', { p_campaign: selected, p_email: address,
      p_allowed: allowed, p_reference: allowed ? reference : 'Autorização retirada pelo administrador',
      p_valid_until: allowed && validUntil ? new Date(validUntil).toISOString() : null });
    if (error) throw error;
    setMessage(allowed ? uiText("Participante autorizado; os critérios serão verificados a cada emissão.") : uiText("Autorização retirada."));
    setEmail(''); setReference(''); setVerified(false);
  });
  const set = <K extends keyof CampaignConfig>(key: K, value: CampaignConfig[K]) => setConfig(c => ({ ...c, [key]: value }));
  const numeric: { key: 'max_per_user' | 'max_total' | 'active_within_days' | 'min_account_days' | 'invite_ttl_hours'; label: string; min: number; max: number }[] = [
    { key: 'max_per_user', label: uiText("Máximo por participante"), min: 1, max: 10 },
    { key: 'max_total', label: uiText("Máximo total da campanha"), min: 1, max: 100000 },
    { key: 'active_within_days', label: uiText("Login nos últimos dias"), min: 1, max: 90 },
    { key: 'min_account_days', label: uiText("Antiguidade mínima em dias"), min: 0, max: 3650 },
    { key: 'invite_ttl_hours', label: uiText("Validade do convite em horas"), min: 1, max: 168 },
  ];
  const current = campaigns.find(c => c.id === selected);
  return <details className="rounded-xl border p-4 space-y-4">
    <summary className="cursor-pointer font-semibold">{uiText("Campanhas de convites controladas")}</summary>
    <p className="text-sm text-muted-foreground">{uiText("Sem atribuição automática. Cada participante exige autorização nominal e confirmação de presença verificada. A conta deve existir antes da criação da campanha.")}</p>
    <label className="block">{uiText("Campanha a gerir")}<select className="w-full rounded-md border bg-background p-2" value={selected ?? ''} disabled={busy} onChange={e => {
        const c = campaigns.find(item => item.id === e.target.value);
        reportRequest.current++; setEmail(''); setReference(''); setValidUntil('');
        setSelected(c?.id ?? null); setConfig(c ?? initial()); setOffset(0); setReport(undefined); setVerified(false);
      }}><option value="">{uiText("Nova campanha")}</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name} — {campaignStateLabels[c.status]}</option>)}</select>
    </label>
    <form onSubmit={e => { e.preventDefault(); void save(config); }}>
      <fieldset disabled={busy || current?.status === 'closed'} className="space-y-4">
        <label className="block">{uiText("Nome")}<Input required minLength={3} maxLength={120} value={config.name} onChange={e => set('name', e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['starts_at', 'ends_at'] as const).map(key => <label key={key} className="block">{uiText("{{value1}} (hora local)", { value1: (key === 'starts_at' ? uiText("Início") : uiText("Fim")) ?? "" })}<Input type="datetime-local" required value={localDate(config[key])} onChange={e => { if (e.target.value) set(key, new Date(e.target.value).toISOString()); }} />
          </label>)}
          {numeric.map(({ key, label, min, max }) => <label key={key} className="block">{label}<Input type="number" required min={min} max={max} value={config[key]} onChange={e => set(key, Number(e.target.value))} /></label>)}
        </div>
        <label className="flex gap-2"><input type="checkbox" checked={config.require_confirmed_email} onChange={e => set('require_confirmed_email', e.target.checked)} />{uiText("Exigir email confirmado")}</label>
        <Button type="submit">{selected ? uiText("Guardar condições") : uiText("Criar rascunho")}</Button>
      </fieldset>
    </form>
    {selected && current && <div className="space-y-4">
      <p>{uiText("Estado: {{value1}}. A suspensão bloqueia emissão e utilização dos convites pendentes. O encerramento é definitivo.", { value1: (campaignStateLabels[current.status]) ?? "" })}</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || current.status === 'active' || current.status === 'closed'} onClick={() => void save({ ...current, status: 'active' })}>{uiText("Ativar campanha")}</Button>
        <Button variant="outline" disabled={busy || current.status !== 'active'} onClick={() => void save({ ...current, status: 'suspended' })}>{uiText("Suspender campanha")}</Button>
        <Button variant="destructive" disabled={busy || current.status === 'closed'} onClick={() => {
          if (window.confirm(uiText("Encerrar definitivamente esta campanha e bloquear os convites pendentes?"))) void save({ ...current, status: 'closed' });
        }}>{uiText("Encerrar campanha")}</Button>
      </div>
      <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); void member(email, true); }}>
        <h4 className="font-medium">{uiText("Autorizar participante")}</h4>
        <label className="block">{uiText("Email do participante")}<Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block">{uiText("Referência da verificação de presença")}<Input required minLength={8} maxLength={500} value={reference} onChange={e => setReference(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">{uiText("Indica a referência do processo revisto. Não coloques documentos nem dados pessoais sensíveis neste campo.")}</p>
        <label className="block">{uiText("Verificação válida até (hora local)")}<Input type="datetime-local" required value={validUntil} max={localDate(current.ends_at)} onChange={e => setValidUntil(e.target.value)} /></label>
        <label className="flex gap-2"><input type="checkbox" required checked={verified} onChange={e => setVerified(e.target.checked)} />{uiText("Confirmei a presença verificada deste participante.")}</label>
        <Button type="submit" disabled={busy || !verified || current.status === 'closed'}>{uiText("Autorizar nesta campanha")}</Button>
      </form>
      {report && <div className="space-y-4">
        <p>{uiText("{{value1}} emitidos · {{value2}} utilizados · {{value3}} expirados · {{value4}} pendentes", { value1: (report.issued) ?? "", value2: (report.used) ?? "", value3: (report.expired) ?? "", value4: (report.pending) ?? "" })}</p>
        <h4 className="font-medium">{uiText("Participantes")}</h4>
        {report.members?.map(m => <div key={m.user_id} className="flex flex-wrap gap-2 border-b py-2 text-sm"><span className="break-all">{m.email} — {m.revoked_at ? uiText("Revogado") : m.eligible ? uiText("Elegível") : uiText("Critérios por cumprir")}</span><Button variant="outline" disabled={busy || !!m.revoked_at || current.status === 'closed'} onClick={() => void member(m.email, false)}>{uiText("Revogar")}</Button></div>)}
        <h4 className="font-medium">{uiText("Convites")}</h4>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>{uiText("Destinatário")}</th><th>{uiText("Estado")}</th><th>{uiText("Emissão")}</th><th>{uiText("Expiração")}</th></tr></thead><tbody>
          {report.invitations.map(i => <tr key={i.code}><td className="break-all">{i.recipient_email || uiText("Ligação individual")}</td><td>{{ pending: uiText('Pendente'), used: uiText('Utilizado'), expired: uiText('Expirado') }[i.state]}</td><td>{new Date(i.created_at).toLocaleString(uiLocale())}</td><td>{new Date(i.expires_at).toLocaleString(uiLocale())}</td></tr>)}
        </tbody></table></div>
        <h4 className="font-medium">{uiText("Histórico de auditoria")}</h4>
        {report.audit?.map(a => <details key={a.id} className="text-sm"><summary>{new Date(a.created_at).toLocaleString(uiLocale())} — {a.action}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(a.details, null, 2)}</pre></details>)}
        <p className="text-xs">{uiText("Página {{value1}}: até 50 registos por lista.", { value1: (offset / 50 + 1) ?? "" })}</p>
        <Button variant="outline" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - 50))}>{uiText("Página anterior")}</Button>
        <Button variant="outline" disabled={report.invitations.length < 50 && (report.members?.length ?? 0) < 50 && (report.audit?.length ?? 0) < 50} onClick={() => setOffset(n => n + 50)}>{uiText("Página seguinte")}</Button>
      </div>}
      <Button variant="ghost" disabled={busy} onClick={() => void run(async () => {})}>{uiText("Atualizar relatório")}</Button>
    </div>}
    <p role="status">{message}</p>
  </details>;
}
