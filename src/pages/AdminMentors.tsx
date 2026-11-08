import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { academiaContent } from '@/features/academia/content-copy';
import { uiServerMessage } from '@/i18n/server-copy';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAdmin } from '@/hooks/useAdmin';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { mentorStatus, useRefreshMentors } from '@/features/academia/hooks/useMentorGovernance';
import { toast } from 'sonner';

interface Mentor {
  user_id: string; display_name: string; username: string; specialty: string; mentor_bio: string;
  translations?: Database['public']['Tables']['mentor_profiles']['Row']['translations'];
  experience: string; status: string; is_verified_mentor: boolean; pending_sessions: number; latest_action: string;
}
const mentorActions: Record<string, string> = {
  get delete() { return uiText('Apagar perfil sem histórico'); },
  get approve() { return uiText('Aprovar'); },
  get reject() { return uiText('Rejeitar'); },
  get suspend() { return uiText('Suspender'); },
  get reactivate() { return uiText('Reactivar'); },
  get deactivate() { return uiText('Desactivar'); },
  get verify() { return uiText('Verificar para cobrar'); },
  get unverify() { return uiText('Retirar verificação'); },
};
export default function AdminMentors() {
  useUiLocale();
  const { isAdmin, loading } = useAdmin();
  const refresh = useRefreshMentors();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [decision, setDecision] = useState<{ mentor: Mentor; action: string } | null>(null);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<string | null>(null);
  const mentors = useQuery({
    queryKey: ['admin-mentors'], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('academia_admin_mentors');
      if (error) throw error;
      return data as unknown as Mentor[];
    },
  });
  const audit = useQuery({
    queryKey: ['mentor-audit', history], enabled: isAdmin && !!history,
    queryFn: async () => {
      const { data, error } = await supabase.from('academia_mentor_audit').select('*').eq('mentor_id', history!).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!decision) throw new Error('Seleccione uma acção.');
      const { error } = await supabase.rpc('academia_manage_mentor', { p_user: decision.mentor.user_id, p_action: decision.action, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: async () => { await refresh(); setDecision(null); setReason(''); toast.success(uiText("Decisão registada.")); },
    onError: error => toast.error(uiServerMessage(error.message, uiText('Não foi possível registar a decisão.'))),
  });
  if (loading) return <p className="p-6">{uiText("A verificar acesso…")}</p>;
  if (!isAdmin) return <p className="p-6" role="alert">{uiText("Acesso reservado a administradores.")}</p>;
  return <main className="mx-auto max-w-3xl p-4 pb-24 space-y-4 safe-top">
    <Link to="/admin">{uiText("← Administração")}</Link><h1 className="text-xl font-bold">{uiText("Gestão de Mentores")}</h1>
    <p className="text-sm text-muted-foreground">{uiText("A aprovação permite criar sessões. A verificação permite cobrar. Desactivar preserva a conta e todo o histórico.")}</p>
    <Input aria-label={uiText("Pesquisar mentores")} placeholder={uiText("Nome, @utilizador ou especialidade")} value={search} onChange={e => setSearch(e.target.value)} />
    <select aria-label={uiText("Filtrar estado")} className="w-full rounded border bg-background p-3" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{uiText("Todos os estados")}</option>{Object.entries(mentorStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="exit">{uiText("Pedidos de desactivação")}</option></select>
    {mentors.isLoading && <p>{uiText("A carregar mentores…")}</p>}
    {mentors.isError && <div role="alert">{uiText("Não foi possível carregar os mentores. ")}<Button onClick={() => mentors.refetch()}>{uiText("Tentar novamente")}</Button></div>}
    {mentors.data?.length === 0 && <p>{uiText("Sem candidaturas.")}</p>}
    {mentors.data?.filter(m => (filter === 'all' || m.status === filter || (filter === 'exit' && m.latest_action === 'request_deactivation')) && `${m.display_name} ${m.username} ${m.specialty} ${academiaContent(m.specialty, m.translations?.specialty)}`.toLocaleLowerCase().includes(search.replace(/^@/, '').toLocaleLowerCase())).map(m => {
      const actions = [...(['pending', 'review_required'].includes(m.status) ? ['approve', 'reject'] : []), ...(['active', 'review_required'].includes(m.status) ? ['suspend'] : []), ...(['suspended', 'inactive'].includes(m.status) ? ['reactivate'] : []), ...(m.status === 'active' ? [m.is_verified_mentor ? 'unverify' : 'verify'] : []), ...(m.status !== 'inactive' ? ['deactivate'] : []), ...(['pending', 'rejected', 'inactive'].includes(m.status) ? ['delete'] : [])];
      return <section key={m.user_id} className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold"><Link to={`/academia/mentor/${m.user_id}`}>{m.display_name || m.username}</Link> <span className="text-sm text-muted-foreground">@{m.username}</span></h2>
        <p>{mentorStatus[m.status]}{m.is_verified_mentor ? uiText(" · Verificado para cobrar") : ''}</p>
        {m.latest_action === 'request_deactivation' && <p className="font-medium">{uiText("Desactivação solicitada")}</p>}
        <p><strong>{uiText("Especialidade:")}</strong> <bdi>{academiaContent(m.specialty, m.translations?.specialty) || uiText("Por preencher")}</bdi></p><p className="whitespace-pre-wrap"><strong>{uiText("Biografia:")}</strong> <bdi>{academiaContent(m.mentor_bio, m.translations?.biography) || uiText("Por preencher")}</bdi></p><p className="whitespace-pre-wrap"><strong>{uiText("Experiência:")}</strong> <bdi>{academiaContent(m.experience, m.translations?.experience) || uiText("Por preencher")}</bdi></p>
        <p className="text-sm">{uiText("Sessões agendadas ou em curso: {{value1}}", { value1: (m.pending_sessions) ?? "" })}</p>
        <div className="flex flex-wrap gap-2">{actions.map(action => <Button key={action} variant="outline" onClick={() => { setDecision({ mentor: m, action }); setReason(''); }}>{mentorActions[action]}</Button>)}<Button variant="ghost" onClick={() => setHistory(m.user_id)}>{uiText("Histórico de decisões")}</Button></div>
      </section>;
    })}
    <Dialog open={!!decision} onOpenChange={open => { if (!open && !mutation.isPending) setDecision(null); }}><DialogContent><DialogHeader><DialogTitle>{decision && mentorActions[decision.action]} — {decision?.mentor.display_name}</DialogTitle><DialogDescription>{decision?.action === 'delete' ? uiText("Elimina definitivamente apenas o perfil de mentor sem histórico. A conta YAMILOOK permanece. Esta acção não pode ser desfeita.") : decision?.action === 'suspend' ? uiText("Impede novas reservas e o início de sessões. Não cancela nem reembolsa automaticamente; trate as sessões pendentes no respectivo detalhe.") : uiText("A decisão será registada com o motivo. A conta YAMILOOK e o histórico serão preservados.")}</DialogDescription></DialogHeader>
      <Label htmlFor="decision-reason">{uiText("Motivo da decisão")}</Label><Textarea id="decision-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} />
      <Button disabled={mutation.isPending || reason.trim().length < 3} onClick={() => mutation.mutate()}>{mutation.isPending ? uiText("A guardar…") : uiText("Confirmar decisão")}</Button>
    </DialogContent></Dialog>
    <Dialog open={!!history} onOpenChange={open => { if (!open) setHistory(null); }}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>{uiText("Histórico de decisões")}</DialogTitle><DialogDescription>{uiText("Últimos 100 registos, incluindo autor e motivo.")}</DialogDescription></DialogHeader>{audit.isLoading && <p>{uiText("A carregar…")}</p>}{audit.isError && <Button onClick={() => audit.refetch()}>{uiText("Tentar novamente")}</Button>}{audit.data?.map(a => <div key={a.id} className="border-b py-2 text-sm"><p>{mentorActions[a.action] ?? a.action} · {new Date(a.created_at).toLocaleString(uiLocale())}</p><p dir="auto">{academiaContent(a.reason, a.reason_translations)}</p><p className="text-xs break-all">{uiText("Autor: {{value1}}", { value1: (a.actor_id ?? uiText("Migração")) ?? "" })}</p></div>)}</DialogContent></Dialog>
  </main>;
}
