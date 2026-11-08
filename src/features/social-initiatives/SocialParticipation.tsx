import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FairAddressStep from '@/features/talatona-fair/FairAddressStep';
import { FAIR_PATH, FAIR_SLUG, fairInviteCode, fairInviteUrl, socialAction, type InitiativeCatalog, type Participation } from './api';

export default function SocialParticipation() {
  const { user } = useAuth();
  return <ParticipationContent key={user?.id ?? 'visitor'} />;
}
function ParticipationContent() {
  const { user, loading: authLoading } = useAuth();
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const [condominium, setCondominium] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const invitationRequest = useRef<string | null>(null);
  const catalog = useQuery({ queryKey: ['social-catalog', FAIR_SLUG], queryFn: () => socialAction<InitiativeCatalog>('catalog') });
  const participation = useQuery({
    queryKey: ['social-participation', FAIR_SLUG, user?.id], enabled: !!user,
    queryFn: () => socialAction<Participation>('dashboard'),
  });
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload: Record<string, unknown> }) => socialAction(action, payload),
    onSuccess: async (_, { action }) => {
      if (action === 'issue') invitationRequest.current = null;
      await queryClient.invalidateQueries({ queryKey: ['social-participation', FAIR_SLUG, user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['social-profile', user?.id] });
    },
  });
  const inviteCode = fairInviteCode(search);
  const returnPath = `${FAIR_PATH}${inviteCode ? `?convite=${inviteCode}` : ''}`;
  if (catalog.isPending || authLoading) return <p role="status">A carregar a iniciativa…</p>;
  if (catalog.isError) return <div role="alert"><p>Não foi possível carregar as inscrições.</p><Button onClick={() => void catalog.refetch()}>Tentar novamente</Button></div>;
  const event = catalog.data;
  const data = participation.data;
  const registration = data?.registration;
  const selected = condominium ?? registration?.condominium_id ?? (registration ? '__other__' : '');
  const isOpen = event.status === 'active' && !!event.starts_at && !!event.ends_at && Date.parse(event.starts_at) <= Date.now() && Date.parse(event.ends_at) > Date.now();
  const save = () => mutation.mutate({ action: 'register', payload: {
    condominium_id: selected === '__other__' ? null : selected,
    other_condominium: selected === '__other__' ? other ?? registration?.other_condominium : null,
    consent, invite_code: inviteCode,
  } });
  const issue = () => {
    invitationRequest.current ??= crypto.randomUUID();
    mutation.mutate({ action: 'issue', payload: { request_id: invitationRequest.current } });
  };
  return <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="social-registration">
    <h2 id="social-registration" className="text-xl font-semibold">A minha participação</h2>
    <p className="text-sm">{isOpen ? 'Inscrições abertas' : 'Inscrições fechadas'}</p>
    {!user ? <div className="space-y-3">
      <p>Entre na YAMILOOK para se inscrever nesta iniciativa.</p>
      <Button asChild><a href={`/login?next=${encodeURIComponent(returnPath)}`}>Já tenho conta</a></Button>
      {inviteCode && <Button asChild variant="outline"><a href={`/register?ref=${inviteCode}&next=${encodeURIComponent(returnPath)}`}>Criar conta com este convite</a></Button>}
      {!inviteCode && <p className="text-sm">Para criar conta, utilize um convite YAMILOOK.</p>}
    </div> : <>
      {participation.isPending && <p role="status">A carregar a sua inscrição…</p>}
      {participation.isError && <div role="alert"><p>Não foi possível consultar a sua inscrição.</p><Button onClick={() => void participation.refetch()}>Tentar novamente</Button></div>}
      {data && <>
        {registration && <div className="rounded-xl bg-muted p-3 text-sm space-y-2">
          <p className="font-semibold">Inscrição registada</p>
          <p>{data.address_valid ? 'Residência validada para esta iniciativa' : 'Residência pendente de validação'}</p>
          <p>Adesões elegíveis de vizinhos · {data.completed_invites} / {event.goal_invites}</p>
          {event.require_attendance && <p>{registration.attended_at ? 'Participação confirmada' : 'Participação por confirmar pela organização'}</p>}
          {data.awarded && <p className="font-semibold">Embaixador Social · Distinção conquistada nesta iniciativa</p>}
          <label className="flex items-start gap-2"><input type="checkbox" checked={registration.is_public} disabled={mutation.isPending}
            onChange={e => mutation.mutate({ action: 'visibility', payload: { is_public: e.target.checked } })} />Mostrar esta iniciativa e a distinção no meu perfil público</label>
        </div>}
        <div className="space-y-2">
          <label htmlFor="social-condominium" className="text-sm font-medium">Condomínio</label>
          <select id="social-condominium" className="min-h-11 w-full rounded-md border bg-background px-3" value={selected}
            disabled={mutation.isPending} onChange={e => { setCondominium(e.target.value); setConsent(false); }}>
            <option value="">Seleccione o seu condomínio</option>
            {event.condominiums.map(item => <option key={item.id} value={item.id}>{item.name} · {item.area}</option>)}
            <option value="__other__">Outro condomínio ou zona de residência</option>
          </select>
          {selected === '__other__' && <label className="block text-sm">Condomínio ou zona<Input maxLength={120} value={other ?? registration?.other_condominium ?? ''} onChange={e => { setOther(e.target.value); setConsent(false); }} /></label>}
        </div>
        <FairAddressStep />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} disabled={mutation.isPending} onChange={e => setConsent(e.target.checked)} />Autorizo a utilização do meu endereço AFROLOC para validar a minha residência e elegibilidade nesta iniciativa.</label>
        <Button onClick={save} disabled={!isOpen || !selected || !consent || mutation.isPending}>{registration ? 'Actualizar inscrição' : 'Confirmar inscrição'}</Button>
        {registration && <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">Os meus cinco convites</h3>
          <p className="text-sm">{data.invitations.length} de 5 emitidos. Cada ligação permite uma adesão. Os convites expirados contam para este limite.</p>
          <Button onClick={issue} disabled={!isOpen || !data.address_valid || data.invitations.length >= 5 || mutation.isPending}>Criar convite</Button>
          <ul className="space-y-3">{data.invitations.map((invitation, index) => <li key={invitation.code} className="space-y-2 rounded-lg border p-3 text-sm">
            <p>Convite {index + 1} · {invitation.completed ? 'Adesão elegível confirmada' : invitation.used ? 'Aceite · validação pendente' : Date.parse(invitation.expires_at) <= Date.now() ? 'Expirado' : 'Disponível'}</p>
            <p>Validade · {new Date(invitation.expires_at).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}</p>
            <a className="block break-all underline" href={fairInviteUrl(invitation.code)}>{fairInviteUrl(invitation.code)}</a>
            {!invitation.used && Date.parse(invitation.expires_at) > Date.now() && <Button variant="outline" onClick={async () => {
              try { await navigator.clipboard.writeText(`Participe na Feira de Natal Solidário. ${fairInviteUrl(invitation.code)}`); setCopyMessage('Convite copiado. Pode partilhá-lo com um vizinho.'); }
              catch { setCopyMessage('Copie a ligação apresentada no convite.'); }
            }}>Copiar convite</Button>}
          </li>)}</ul>
          <p role="status" className="text-sm">{copyMessage}</p>
        </div>}
      </>}
    </>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    {mutation.isPending && <p role="status" className="text-sm">A guardar…</p>}
  </section>;
}
