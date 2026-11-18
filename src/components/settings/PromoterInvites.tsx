import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uiLocale, uiText } from '@/i18n/ui-copy';
import { campaignClient, campaignError, canIssueCampaign, type CampaignReport, type InvitationCampaign } from '@/lib/invitation-campaigns';
import { buildWhatsAppInviteUrl } from '@/lib/invite-delivery';
import { buildInviteUrl } from '@/lib/referral';

interface Props {
  campaign: InvitationCampaign;
  report?: CampaignReport;
  onIssued: (report: CampaignReport, name: string) => void;
}

export function PromoterInvites({ campaign, report, onIssued }: Props) {
  const [name, setName] = useState(campaign.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const issue = async () => {
    if (busy || !canIssueCampaign(campaign)) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await campaignClient.rpc('issue_promoter_invitations', { p_campaign: campaign.id, p_name: name.trim() });
      if (error || !data) throw error;
      onIssued(data, name.trim());
    } catch (error) {
      setMessage(campaignError(error));
    } finally {
      setBusy(false);
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(uiText('Copiado. Cola o convite na mensagem para o teu convidado.'));
    } catch {
      setMessage(uiText('Não foi possível copiar automaticamente. Selecciona o código ou o link acima e copia manualmente.'));
    }
  };
  return <div className="space-y-4">
    {report && report.issued < 10 && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void issue(); }}>
      <label className="block">{uiText('Nome da campanha')}
        <Input value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} disabled={busy || report.issued > 0} />
      </label>
      <Button type="submit" disabled={busy || !canIssueCampaign(campaign) || name.trim().length < 3}>
        {busy ? uiText('A emitir…') : uiText('Gerar 10 convites')}
      </Button>
    </form>}
    {report && <p role="status">{uiText('{{value1}} emitidos · {{value2}} utilizados · {{value3}} expirados · {{value4}} pendentes', {
      value1: report.issued, value2: report.used, value3: report.expired, value4: report.pending,
    })}</p>}
    <ol className="space-y-2">
      {report?.invitations.map((invitation, index) => {
        const url = buildInviteUrl(invitation.code);
        const available = invitation.state === 'pending' && campaign.status === 'active' && Date.parse(campaign.ends_at) > Date.now();
        return <li key={invitation.code} className="space-y-2 rounded-md border p-3">
          <p className="font-medium">{uiText('Convite {{number}}', { number: index + 1 })} · {invitation.state === 'used'
            ? uiText('Utilizado') : invitation.state === 'expired' ? uiText('Expirado') : uiText('Pendente')}</p>
          {available && <>
            <Input aria-label={uiText('Ligação individual')} readOnly value={url} onFocus={e => e.target.select()} />
            <p className="text-xs text-muted-foreground">{uiText('Válido até {{value1}}.', { value1: new Date(invitation.expires_at).toLocaleString(uiLocale()) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copy(url)}>{uiText('Copiar link')}</Button>
              <Button variant="outline" asChild><a href={buildWhatsAppInviteUrl(invitation.recipient_email ?? '', invitation.code, 'YAMILOOK', invitation.expires_at, campaign.name)} target="_blank" rel="noopener noreferrer">{uiText('Partilhar no WhatsApp')}</a></Button>
            </div>
          </>}
        </li>;
      })}
    </ol>
    <p role="status">{message}</p>
  </div>;
}
