import { useAdminAreas } from '@/features/admin-areas/useAdminAreas';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { campaignClient, type InvitationCampaign } from '@/lib/invitation-campaigns';
import { buildInviteUrl } from '@/lib/referral';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FounderInviteAssistant } from './FounderInviteAssistant';
import { InvitationCampaignAdmin } from './InvitationCampaignAdmin';
import { SharedRegistrationLinks, type SharedLink } from './SharedRegistrationLinks';
import { ShareRegistrationInvite } from '../ShareRegistrationInvite';
import { trustedCopy } from '@/features/trusted-invites/copy';
import { useNavigate } from 'react-router-dom';

const labels = () => ({ active: uiText('Activas'), draft: uiText('Rascunhos'), suspended: uiText('Suspensas'), closed: uiText('Encerradas') });
const stateLabel = (state: string) => ({ active: uiText('Activa'), suspended: uiText('Suspensa'), closed: uiText('Encerrada'), draft: uiText('Rascunho') } as Record<string,string>)[state] ?? state;
const normalise = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function CampaignHub() {
  const locale = useUiLocale();
  const access = useAdminAreas();
  const navigate = useNavigate();
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [campaigns, setCampaigns] = useState<InvitationCampaign[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [panel, setPanel] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a,b] = await Promise.all([supabase.rpc('admin_registration_links' as never, {} as never), campaignClient.rpc('list_invitation_campaigns', {})]);
      if (a.error || b.error) throw a.error || b.error;
      setLinks((a.data ?? []) as unknown as SharedLink[]);
      setCampaigns(b.data ?? []);
    } catch { setStatus(uiText('Não foi possível actualizar as campanhas.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const rows = [
    ...links.map(link => ({ id: link.id, name: link.name, end: link.expires_at, state: link.uses_count >= link.max_uses ? 'closed' : link.status, type: 'Convite colectivo', link, campaign: undefined })),
    ...campaigns.map(campaign => ({ id: campaign.id, name: campaign.name, end: campaign.ends_at, state: campaign.status, type: campaign.promoter_id ? 'Campanha de promotor' : 'Campanha controlada', campaign, link: undefined })),
  ].map(row => ({ ...row, state: Date.parse(row.end) <= Date.now() ? 'closed' : row.state }))
    .filter(row => (!filter || row.state === filter) && normalise(row.name).includes(normalise(query.trim())))
    .sort((a,b) => Number(b.state === 'active') - Number(a.state === 'active') || a.name.localeCompare(b.name,locale));
  return <section id="convites-coletivos" className="space-y-4 rounded-xl border p-4">
    <h2 className="text-xl font-semibold">{uiText('Campanhas e convites')}</h2>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setPanel('create')}>{uiText('Criar campanha')}</Button>
      <Button variant="outline" onClick={() => setPanel('individual')}>{uiText('Criar convite individual')}</Button>
      <Button variant="outline" disabled={!access.allowed.admin_trusted_invites} onClick={() => navigate('/admin/convites-confianca')}>{trustedCopy(locale).title}</Button>
      <Button variant="ghost" onClick={refresh}>{uiText('Atualizar')}</Button>
    </div>
    {panel === 'create' && <div className="flex gap-2"><Button variant="outline" onClick={() => setPanel('collective')}>{uiText('Convite colectivo')}</Button><Button variant="outline" onClick={() => setPanel('promoter')}>{uiText('Campanha de promotor')}</Button></div>}
    {panel === 'collective' && <CreateLink onCreated={() => {setPanel(''); void refresh();}} />}
    {panel === 'promoter' && <InvitationCampaignAdmin onSaved={refresh} />}
    {panel === 'individual' && <FounderInviteAssistant onOpenTrusted={() => navigate('/admin/convites-confianca')} />}
    <Input aria-label={uiText('Pesquisar campanhas')} placeholder={uiText('Pesquisar campanhas por nome')} value={query} onChange={e => setQuery(e.target.value)} />
    <select aria-label={uiText('Estado')} value={filter} onChange={e => setFilter(e.target.value)} className="rounded-md border bg-background p-2">
      <option value="">{uiText('Todos os estados')}</option>{Object.entries(labels()).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    <p role="status">{status || (loading ? uiText('A carregar…') : !rows.length ? uiText('Nenhuma campanha encontrada.') : '')}</p>
    {rows.map(({id,name,end,state,type,link,campaign}) => <article key={id} className="space-y-2 rounded-xl border p-4">
      <h3 className="font-semibold">{name}</h3><p>{type === 'Convite colectivo' ? uiText('Convite colectivo') : type === 'Campanha de promotor' ? uiText('Campanha de promotor') : uiText('Campanha controlada')} · {stateLabel(state)}</p>
      <p>{uiText('Válido até {{date}}', {date:new Date(end).toLocaleString(locale)})}</p>
      {link && <p>{uiText('Inscrições: {{used}} de {{limit}}', {used:link.uses_count,limit:link.max_uses})} · {uiText('Vagas disponíveis: {{count}}',{count:state === 'active' ? (link.remaining ?? Math.max(0,link.max_uses-link.uses_count)) : 0})}</p>}
      <div className="flex flex-wrap items-start gap-2">
        {link && state === 'active' && <><ShareRegistrationInvite code={link.code} /><Button variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(buildInviteUrl(link.code)); setStatus(uiText('Copiado!')); } catch { setStatus(uiText('Não foi possível copiar a ligação.')); }
        }}>{uiText('Copiar ligação')}</Button></>}
        <Button variant="outline" aria-expanded={panel === id} onClick={() => setPanel(panel === id ? '' : id)}>{uiText('Gerir')}</Button>
      </div>
      {panel === id && (campaign ? <InvitationCampaignAdmin initialCampaign={campaign} onSaved={refresh} /> : <SharedRegistrationLinks onlyId={id} onChanged={refresh} />)}
    </article>)}
  </section>;
}

function CreateLink({onCreated}: {onCreated: () => void}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  return <form className="space-y-2" onSubmit={async event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await supabase.rpc('create_registration_link' as never, {p_request_id:requestId,p_name:String(values.get('name')).trim(),p_max_uses:Number(values.get('limit')),p_ttl_hours:Number(values.get('hours'))} as never);
      if (result.error) throw result.error;
      onCreated();
    } catch { setError(uiText('Não foi possível criar o convite.')); }
    finally { setBusy(false); }
  }}>
    <label>{uiText('Nome')}<Input name="name" required maxLength={160} /></label>
    <label>{uiText('Vagas')}<Input name="limit" type="number" required min={1} max={100000} defaultValue={10} /></label>
    <label>{uiText('Validade do convite em horas')}<Input name="hours" type="number" required min={1} max={168} defaultValue={168} /></label>
    <Button disabled={busy}>{uiText('Criar convite colectivo')}</Button><p role="status">{error}</p>
  </form>;
}
