import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FAIR_SLUG, socialAction, type InitiativeCatalog, type InitiativeReport, type SocialRegistration } from './api';

export default function InitiativeAdmin() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  return isAdmin ? <AdminContent key={user?.id} /> : null;
}
function AdminContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const catalog = useQuery({ queryKey: ['social-catalog', FAIR_SLUG], queryFn: () => socialAction<InitiativeCatalog>('catalog') });
  const report = useQuery({ queryKey: ['social-report', FAIR_SLUG, user?.id, offset], queryFn: () => socialAction<InitiativeReport>('report', { offset }) });
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload: Record<string, unknown> }) => socialAction(action, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['social-report', FAIR_SLUG] });
      await queryClient.invalidateQueries({ queryKey: ['social-catalog', FAIR_SLUG] });
      await queryClient.invalidateQueries({ queryKey: ['social-participation', FAIR_SLUG] });
      await queryClient.invalidateQueries({ queryKey: ['social-profile'] });
    },
  });
  if (catalog.isPending) return <p role="status">A carregar a iniciativa…</p>;
  if (catalog.isError) return <p role="alert">Falha ao carregar a iniciativa. <button className="underline" onClick={() => void catalog.refetch()}>Tentar novamente</button></p>;
  return <section className="space-y-4 rounded-xl border p-4" aria-labelledby="social-admin">
    <h2 id="social-admin" className="font-semibold">Feira de Natal Solidário · Inscrições e distinções</h2>
    <Configuration key={JSON.stringify(catalog.data)} catalog={catalog.data} busy={mutation.isPending}
      onSave={payload => mutation.mutate({ action: 'configure', payload })} />
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    {mutation.isSuccess && <p role="status" className="text-sm">Alteração guardada.</p>}
    {report.isPending && <p role="status">A carregar inscrições…</p>}
    {report.isError && <p role="alert">Falha ao carregar inscrições. <button className="underline" onClick={() => void report.refetch()}>Tentar novamente</button></p>}
    {report.data && <>
      <p className="text-sm">{report.data.total} inscrições</p>
      <div className="space-y-4">{report.data.registrations.map(row => <details key={row.user_id} className="rounded-lg border p-3">
        <summary className="cursor-pointer">{row.display_name || row.username} · {row.address_valid ? 'Residência validada' : 'Validação pendente'}</summary>
        <ResidenceReview key={JSON.stringify(row)} row={row} catalog={catalog.data} busy={mutation.isPending} self={row.user_id === user?.id}
          onAction={(action,payload) => mutation.mutate({ action, payload: { ...payload, user_id: row.user_id } })} />
      </details>)}</div>
      <div className="flex gap-3"><Button variant="outline" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0,value-50))}>Anterior</Button>
        <Button variant="outline" disabled={offset+50 >= report.data.total} onClick={() => setOffset(value => value+50)}>Seguinte</Button></div>
    </>}
  </section>;
}
function Configuration({ catalog, busy, onSave }: { catalog: InitiativeCatalog; busy: boolean; onSave: (payload: Record<string, unknown>) => void }) {
  const localDateTime = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  };
  const [starts, setStarts] = useState(localDateTime(catalog.starts_at));
  const [ends, setEnds] = useState(localDateTime(catalog.ends_at));
  const [capacity, setCapacity] = useState(catalog.capacity?.toString() || '');
  const [status, setStatus] = useState(catalog.status);
  const [goal, setGoal] = useState(catalog.goal_invites.toString());
  const [attendance, setAttendance] = useState(catalog.require_attendance);
  return <form className="grid gap-3 text-sm sm:grid-cols-2" onSubmit={event => {
    event.preventDefault();
    onSave({ status, starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString(), capacity: Number(capacity), goal_invites: Number(goal), require_attendance: attendance });
  }}>
    <p className="sm:col-span-2">Defina o período de inscrição e a capacidade antes de activar. Os horários abaixo usam o fuso horário deste dispositivo. As metas ficam fixas após a primeira inscrição.</p>
    <label>Início das inscrições<Input type="datetime-local" value={starts} onChange={e => setStarts(e.target.value)} required /></label>
    <label>Fim das inscrições<Input type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} min={starts} required /></label>
    <label>Limite de participantes<Input type="number" min={1} max={20000} value={capacity} onChange={e => setCapacity(e.target.value)} required /></label>
    <label>Adesões elegíveis para a distinção<Input type="number" min={0} max={5} value={goal} onChange={e => setGoal(e.target.value)} required /></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={attendance} onChange={e => setAttendance(e.target.checked)} />Exigir participação confirmada</label>
    <label>Estado<select className="min-h-11 w-full rounded border bg-background px-2" value={status} onChange={e => setStatus(e.target.value as InitiativeCatalog['status'])}>
      <option value="draft">Rascunho</option><option value="active">Activa</option><option value="suspended">Suspensa</option><option value="closed">Encerrada</option>
    </select></label>
    <Button type="submit" disabled={busy || catalog.status === 'closed'}>Guardar condições</Button>
  </form>;
}
function ResidenceReview({ row, catalog, busy, self, onAction }: {
  row: SocialRegistration & { completed_invites: number; address_valid: boolean };
  catalog: InitiativeCatalog; busy: boolean; self: boolean;
  onAction: (action: string, payload: Record<string, unknown>) => void;
}) {
  const [condominium, setCondominium] = useState(row.verified_condominium || row.condominium_id || '');
  const [group, setGroup] = useState(row.proximity_group || '');
  const [reference, setReference] = useState(row.evidence_reference || '');
  const [expiry, setExpiry] = useState('');
  return <div className="mt-4 space-y-3 text-sm">
    <p>Endereço declarado · <strong className="break-all">{row.afroloc_code}</strong></p>
    {row.other_condominium && <p>Zona declarada · {row.other_condominium}</p>}
    <p>{row.completed_invites} adesões elegíveis de vizinhos</p>
    <p>Confira a titularidade ou residência no AFROLOC e a localização. A decisão valida a elegibilidade para esta iniciativa.</p>
    {self && <p>Outro administrador deve validar a sua inscrição.</p>}
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      onAction('review',{ approved: true, expected_code: row.afroloc_code, verified_condominium: condominium,
        proximity_group: group, evidence_reference: reference, valid_until: new Date(expiry).toISOString() });
    }}>
      <label className="block">Condomínio confirmado<select className="min-h-11 w-full rounded border bg-background px-2" value={condominium} onChange={e => setCondominium(e.target.value)}>
        <option value="">Validar por proximidade</option>{catalog.condominiums.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label className="block">Identificador da zona de proximidade confirmada<Input value={group} onChange={e => setGroup(e.target.value)} maxLength={120} minLength={3} required={!condominium} /></label>
      <p>Use o mesmo identificador apenas para endereços cuja proximidade tenha sido verificada pela organização.</p>
      <label className="block">Referência interna da evidência<Input value={reference} onChange={e => setReference(e.target.value)} minLength={8} maxLength={500} required /></label>
      <label className="block">Validade da evidência · horário deste dispositivo<Input type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} required /></label>
      <Button type="submit" disabled={busy || self}>Validar residência</Button>
    </form>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || self} onClick={() => onAction('review',{ approved: false })}>Revogar validação</Button>
      <Button variant="outline" disabled={busy || self || !row.address_valid} onClick={() => onAction('attendance',{ approved: !row.attended_at })}>{row.attended_at ? 'Corrigir participação' : 'Confirmar participação'}</Button>
    </div>
  </div>;
}
