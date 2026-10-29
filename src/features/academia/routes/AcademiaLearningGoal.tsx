import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LearningChallengeCard } from '../components/LearningChallengeCard';
import { learningStatus, useLearningAction, useLearningGoal, type LearningGoal } from '../hooks/useAcademiaLearning';
const salesPlan = 'Vamos definir a tua oferta e o cliente, calcular custos e preço e preparar uma apresentação comercial. Cada trabalho recebe feedback antes de avançarmos.';
function MentorPlan({ goal }: { goal: LearningGoal }) {
  const save = useLearningAction(); const [plan, setPlan] = useState(goal.plan); const [template, setTemplate] = useState(false);
  return <form aria-label="Plano de acompanhamento" className="rounded-xl border p-4 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate({ action: 'plan', goalId: goal.id, payload: { plan: plan.trim(), template: template ? 'first_sale' : '' } }); }}>
    <h2 className="font-semibold">{goal.status === 'requested' ? 'Aceitar e definir o plano' : 'Atualizar o plano'}</h2>
    {goal.status === 'requested' && <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={template} onChange={e => { setTemplate(e.target.checked); if (e.target.checked) setPlan(salesPlan); }} />Usar modelo “Da ideia à primeira venda” com três desafios</label>}
    <label className="block space-y-1"><span className="text-sm">Como vais acompanhar o aluno?</span><Textarea required minLength={10} maxLength={4000} value={plan} onChange={e => setPlan(e.target.value)} /></label>
    {save.error && <p role="alert" className="text-destructive text-sm">{save.error.message}</p>}
    <Button disabled={save.isPending || plan.trim().length < 10}>{save.isPending ? 'A guardar…' : goal.status === 'requested' ? 'Aceitar acompanhamento' : 'Guardar plano'}</Button>
    {save.isSuccess && <p role="status" className="text-sm">Plano guardado.</p>}
  </form>;
}
function NewChallenge({ goalId }: { goalId: string }) {
  const save = useLearningAction(); const [title, setTitle] = useState(''); const [instructions, setInstructions] = useState(''); const [skill, setSkill] = useState('');
  return <form aria-label="Novo desafio" className="rounded-xl border p-4 space-y-3" onSubmit={async e => {
    e.preventDefault();
    try { await save.mutateAsync({ action: 'challenge', goalId, payload: { title: title.trim(), instructions: instructions.trim(), skill: skill.trim() } }); setTitle(''); setInstructions(''); setSkill(''); } catch { /* alert below */ }
  }}>
    <h2 className="font-semibold">Propor um desafio</h2>
    <label className="block space-y-1"><span className="text-sm">Título do desafio</span><Input required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label className="block space-y-1"><span className="text-sm">O que deve ser entregue e como será avaliado?</span><Textarea required minLength={3} maxLength={3000} value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
    <label className="block space-y-1"><span className="text-sm">Competência a demonstrar</span><Input required minLength={3} maxLength={100} value={skill} onChange={e => setSkill(e.target.value)} placeholder="Ex.: formação de preços" /></label>
    {save.error && <p role="alert" className="text-destructive text-sm">{save.error.message}</p>}
    <Button disabled={save.isPending || Math.min(title.trim().length, instructions.trim().length, skill.trim().length) < 3}>{save.isPending ? 'A guardar…' : 'Adicionar desafio'}</Button>
  </form>;
}
export default function AcademiaLearningGoal() {
  const { goalId } = useParams(); const navigate = useNavigate(); const { user } = useAuth();
  const query = useLearningGoal(goalId); const save = useLearningAction(); const [reason, setReason] = useState(''); const [closing, setClosing] = useState(false);
  const data = query.data; const goal = data?.goal; const mentor = goal?.mentor_id === user?.id;
  const active = goal?.status === 'active'; const closed = goal?.status === 'completed' || goal?.status === 'cancelled';
  const approved = data?.challenges.filter(c => c.status === 'approved') || [];
  return <main className="h-screen-safe overflow-y-auto bg-background safe-top pb-8">
    <header className="sticky top-0 z-10 bg-background border-b p-3 flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Voltar aos percursos" onClick={() => navigate('/academia/percursos')}><ArrowLeft /></Button><h1 className="font-semibold">O meu percurso</h1><Button className="ml-auto" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Atualizar</Button></header>
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      {query.isLoading && <p role="status">A carregar percurso…</p>}
      {query.isError && <p role="alert">Não foi possível atualizar o percurso. Verifica a ligação e tenta novamente.</p>}
      {!query.isLoading && !query.isError && !data && <p>Este percurso não está disponível para a tua conta.</p>}
      {goal && data && <>
        <section className="space-y-2"><h2 className="text-xl font-semibold break-words">{goal.title}</h2><p className="text-sm text-primary">{learningStatus[goal.status]}</p><p className="text-sm text-muted-foreground break-words">Aluno: {data.learnerName} · Mentor: {data.mentorName}</p><p className="whitespace-pre-wrap break-words">{goal.context}</p></section>
        {goal.closure_reason && <p className="rounded-xl border p-3 text-sm whitespace-pre-wrap break-words">Motivo do encerramento: {goal.closure_reason}</p>}
        {goal.plan && <section className="rounded-xl bg-primary/5 p-4 space-y-2"><h2 className="font-semibold">Plano de acompanhamento</h2><p className="text-sm whitespace-pre-wrap break-words">{goal.plan}</p></section>}
        {!mentor && goal.status === 'requested' && <p role="status">O mentor vai analisar o pedido. O plano e os desafios aparecerão aqui depois da aceitação.</p>}
        {mentor && !closed && <MentorPlan key={goal.status} goal={goal} />}
        {data.challenges.length > 0 && <section aria-label="Progresso do percurso" className="space-y-2"><p className="text-sm">{approved.length} de {data.challenges.length} desafios validados</p><progress className="w-full accent-primary" aria-label="Desafios validados" value={approved.length} max={data.challenges.length} /></section>}
        <section aria-label="Desafios do percurso" className="space-y-4">{data.challenges.map(c => <LearningChallengeCard key={c.id} goalId={goal.id} challenge={c} submissions={data.submissions.filter(s => s.challenge_id === c.id)} isMentor={mentor} active={active} />)}</section>
        {active && !data.challenges.length && <p className="text-muted-foreground">{mentor ? 'Adiciona o primeiro desafio para começar.' : 'O mentor está a preparar os desafios.'}</p>}
        {active && mentor && data.challenges.length < 20 && <NewChallenge goalId={goal.id} />}
        {approved.length > 0 && <section className="rounded-xl border border-primary/30 p-4 space-y-3"><h2 className="font-semibold flex gap-2 items-center"><CheckCircle2 className="w-5 h-5 text-primary" />Competências demonstradas</h2><ul className="list-disc pl-5 text-sm space-y-1 break-words">{[...new Set(approved.map(c => c.skill))].map(skill => <li key={skill}>{skill}</li>)}</ul><p className="text-xs text-muted-foreground">Trabalhos validados por {data.mentorName} neste percurso. Este registo não equivale a uma certificação profissional acreditada.</p></section>}
        {save.error && <p role="alert" className="text-destructive">{save.error.message}</p>}
        {mentor && active && <Button disabled={save.isPending || !data.challenges.length || approved.length !== data.challenges.length} onClick={() => save.mutate({ action: 'complete', goalId: goal.id })}>Concluir percurso validado</Button>}
        {!closed && <section className="border-t pt-4 space-y-3"><Button variant="ghost" onClick={() => setClosing(!closing)}>{goal.status === 'requested' && mentor ? 'Recusar acompanhamento' : 'Encerrar acompanhamento'}</Button>
          {closing && <form className="space-y-2" onSubmit={e => { e.preventDefault(); save.mutate({ action: 'cancel', goalId: goal.id, payload: { reason: reason.trim() } }); }}><label className="block space-y-1"><span className="text-sm">Motivo do encerramento</span><Textarea required minLength={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><Button variant="destructive" disabled={save.isPending || reason.trim().length < 3}>Confirmar encerramento</Button></form>}
        </section>}
      </>}
    </div>
  </main>;
}
