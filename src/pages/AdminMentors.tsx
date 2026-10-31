import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAdmin } from '@/hooks/useAdmin';
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
  experience: string; status: string; is_verified_mentor: boolean; pending_sessions: number; latest_action: string;
}
const mentorActions: Record<string, string> = { delete: 'Apagar perfil sem histórico', approve: 'Aprovar', reject: 'Rejeitar', suspend: 'Suspender', reactivate: 'Reactivar', deactivate: 'Desactivar', verify: 'Verificar para cobrar', unverify: 'Retirar verificação' };
export default function AdminMentors() {
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
    onSuccess: async () => { await refresh(); setDecision(null); setReason(''); toast.success('Decisão registada.'); },
    onError: error => toast.error(error.message),
  });
  if (loading) return <p className="p-6">A verificar acesso…</p>;
  if (!isAdmin) return <p className="p-6" role="alert">Acesso reservado a administradores.</p>;
  return <main className="mx-auto max-w-3xl p-4 pb-24 space-y-4 safe-top">
    <Link to="/admin">← Administração</Link><h1 className="text-xl font-bold">Gestão de Mentores</h1>
    <p className="text-sm text-muted-foreground">A aprovação permite criar sessões. A verificação permite cobrar. Desactivar preserva a conta e todo o histórico.</p>
    <Input aria-label="Pesquisar mentores" placeholder="Nome, @utilizador ou especialidade" value={search} onChange={e => setSearch(e.target.value)} />
    <select aria-label="Filtrar estado" className="w-full rounded border bg-background p-3" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(mentorStatus).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="exit">Pedidos de desactivação</option></select>
    {mentors.isLoading && <p>A carregar mentores…</p>}
    {mentors.isError && <div role="alert">Não foi possível carregar os mentores. <Button onClick={() => mentors.refetch()}>Tentar novamente</Button></div>}
    {mentors.data?.length === 0 && <p>Sem candidaturas.</p>}
    {mentors.data?.filter(m => (filter === 'all' || m.status === filter || (filter === 'exit' && m.latest_action === 'request_deactivation')) && `${m.display_name} ${m.username} ${m.specialty}`.toLocaleLowerCase().includes(search.replace(/^@/, '').toLocaleLowerCase())).map(m => {
      const actions = [...(['pending', 'review_required'].includes(m.status) ? ['approve', 'reject'] : []), ...(['active', 'review_required'].includes(m.status) ? ['suspend'] : []), ...(['suspended', 'inactive'].includes(m.status) ? ['reactivate'] : []), ...(m.status === 'active' ? [m.is_verified_mentor ? 'unverify' : 'verify'] : []), ...(m.status !== 'inactive' ? ['deactivate'] : []), ...(['pending', 'rejected', 'inactive'].includes(m.status) ? ['delete'] : [])];
      return <section key={m.user_id} className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold"><Link to={`/academia/mentor/${m.user_id}`}>{m.display_name || m.username}</Link> <span className="text-sm text-muted-foreground">@{m.username}</span></h2>
        <p>{mentorStatus[m.status]}{m.is_verified_mentor ? ' · Verificado para cobrar' : ''}</p>
        {m.latest_action === 'request_deactivation' && <p className="font-medium">Desactivação solicitada</p>}
        <p><strong>Especialidade:</strong> {m.specialty || 'Por preencher'}</p><p className="whitespace-pre-wrap"><strong>Biografia:</strong> {m.mentor_bio || 'Por preencher'}</p><p className="whitespace-pre-wrap"><strong>Experiência:</strong> {m.experience || 'Por preencher'}</p>
        <p className="text-sm">Sessões agendadas ou em curso: {m.pending_sessions}</p>
        <div className="flex flex-wrap gap-2">{actions.map(action => <Button key={action} variant="outline" onClick={() => { setDecision({ mentor: m, action }); setReason(''); }}>{mentorActions[action]}</Button>)}<Button variant="ghost" onClick={() => setHistory(m.user_id)}>Histórico de decisões</Button></div>
      </section>;
    })}
    <Dialog open={!!decision} onOpenChange={open => { if (!open && !mutation.isPending) setDecision(null); }}><DialogContent><DialogHeader><DialogTitle>{decision && mentorActions[decision.action]} — {decision?.mentor.display_name}</DialogTitle><DialogDescription>{decision?.action === 'delete' ? 'Elimina definitivamente apenas o perfil de mentor sem histórico. A conta YAMILOOK permanece. Esta acção não pode ser desfeita.' : decision?.action === 'suspend' ? 'Impede novas reservas e o início de sessões. Não cancela nem reembolsa automaticamente; trate as sessões pendentes no respectivo detalhe.' : 'A decisão será registada com o motivo. A conta YAMILOOK e o histórico serão preservados.'}</DialogDescription></DialogHeader>
      <Label htmlFor="decision-reason">Motivo da decisão</Label><Textarea id="decision-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} />
      <Button disabled={mutation.isPending || reason.trim().length < 3} onClick={() => mutation.mutate()}>{mutation.isPending ? 'A guardar…' : 'Confirmar decisão'}</Button>
    </DialogContent></Dialog>
    <Dialog open={!!history} onOpenChange={open => { if (!open) setHistory(null); }}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Histórico de decisões</DialogTitle><DialogDescription>Últimos 100 registos, incluindo autor e motivo.</DialogDescription></DialogHeader>{audit.isLoading && <p>A carregar…</p>}{audit.isError && <Button onClick={() => audit.refetch()}>Tentar novamente</Button>}{audit.data?.map(a => <div key={a.id} className="border-b py-2 text-sm"><p>{mentorActions[a.action] ?? a.action} · {new Date(a.created_at).toLocaleString('pt-PT')}</p><p>{a.reason}</p><p className="text-xs break-all">Autor: {a.actor_id ?? 'Migração'}</p></div>)}</DialogContent></Dialog>
  </main>;
}
