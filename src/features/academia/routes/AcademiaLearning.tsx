import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAcademiaMentors } from '../hooks/useAcademia';
import { learningStatus, useLearningAction, useLearningGoals } from '../hooks/useAcademiaLearning';

export default function AcademiaLearning() {
  const navigate = useNavigate(); const { user } = useAuth();
  const goals = useLearningGoals(); const mentors = useAcademiaMentors(); const create = useLearningAction();
  const [showForm, setShowForm] = useState(false); const [scope, setScope] = useState('learner');
  const [title, setTitle] = useState(''); const [context, setContext] = useState(''); const [mentor, setMentor] = useState('');
  const available = (mentors.data || []).filter(m => m.id !== user?.id);
  const visible = (goals.data || []).filter(g => scope === 'learner' ? g.learner_id === user?.id : g.mentor_id === user?.id);
  return <main className="h-screen-safe overflow-y-auto bg-background safe-top pb-8">
    <header className="sticky top-0 z-10 bg-background border-b p-3 flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Voltar à Academia" onClick={() => navigate('/academia')}><ArrowLeft /></Button>
      <h1 className="text-lg font-semibold">Aprender e realizar</h1>
    </header>
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <section className="rounded-2xl border bg-primary/5 p-5 space-y-3">
        <Target className="text-primary" /><h2 className="text-xl font-semibold">O que queres conseguir?</h2>
        <p className="text-sm text-muted-foreground">Define um objetivo, recebe um plano do mentor e mostra o que já consegues fazer.</p>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Fechar formulário' : 'Criar o meu objetivo'}</Button>
      </section>
      {showForm && <form aria-label="Novo objetivo" className="rounded-xl border p-4 space-y-4" onSubmit={async e => {
        e.preventDefault();
        try { const id = await create.mutateAsync({ action: 'create', payload: { title: title.trim(), context: context.trim(), mentor_id: mentor } }); navigate(`/academia/percursos/${id}`); } catch { /* mutation alert below */ }
      }}>
        <Button type="button" variant="outline" onClick={() => { setTitle('Da ideia à primeira venda'); setContext('Quero preparar a minha oferta, calcular o preço e apresentar o meu produto ou serviço.'); }}>Usar exemplo: primeira venda</Button>
        <label className="block space-y-1"><span>Quero conseguir…</span><Input required minLength={6} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: preparar o catálogo do meu negócio" /></label>
        <label className="block space-y-1"><span>Conta ao mentor o teu ponto de partida</span><Textarea maxLength={2000} value={context} onChange={e => setContext(e.target.value)} /></label>
        <label className="block space-y-1"><span>Escolher mentor</span><select required value={mentor} onChange={e => setMentor(e.target.value)} className="w-full rounded-md border bg-background p-3">
          <option value="">Seleciona um mentor</option>{available.map(m => <option key={m.id} value={m.id}>{m.name} — {m.specialty}</option>)}
        </select></label>
        {mentors.isLoading && <p role="status">A carregar mentores…</p>}
        {mentors.isError && <p role="alert">Não foi possível carregar os mentores. <Button type="button" variant="link" onClick={() => void mentors.refetch()}>Tentar novamente</Button></p>}
        {!mentors.isLoading && !mentors.isError && !available.length && <p>Ainda não há outro mentor disponível. Podes voltar mais tarde.</p>}
        <p className="text-xs text-muted-foreground">O objetivo e as entregas são privados entre ti e o mentor escolhido. O acompanhamento começa quando o mentor aceitar. Este pedido não efetua cobranças em Kumbu.</p>
        {create.error && <p role="alert" className="text-destructive">{create.error.message}</p>}
        <Button disabled={create.isPending || !mentor || title.trim().length < 6}>{create.isPending ? 'A enviar…' : 'Pedir acompanhamento'}</Button>
      </form>}
      <div className="flex flex-wrap gap-2" aria-label="Ver percursos">
        <Button variant={scope === 'learner' ? 'default' : 'outline'} aria-pressed={scope === 'learner'} onClick={() => setScope('learner')}>Os meus objetivos</Button>
        <Button variant={scope === 'mentor' ? 'default' : 'outline'} aria-pressed={scope === 'mentor'} onClick={() => setScope('mentor')}>A acompanhar como mentor</Button>
      </div>
      {goals.isLoading && <p role="status">A carregar percursos…</p>}
      {goals.isError && <p role="alert">Não foi possível carregar os percursos. <Button variant="link" onClick={() => void goals.refetch()}>Tentar novamente</Button></p>}
      {!goals.isLoading && !goals.isError && !visible.length && <p className="text-muted-foreground">{scope === 'mentor' ? 'Os pedidos dos alunos aparecerão aqui.' : 'Ainda não tens percursos. Começa com um objetivo concreto.'}</p>}
      <section aria-label="Percursos recentes" className="space-y-3">
        {visible.map(g => <button key={g.id} className="w-full text-left rounded-xl border p-4 space-y-2 hover:bg-muted/40" onClick={() => navigate(`/academia/percursos/${g.id}`)}>
          <h2 className="font-semibold break-words">{g.title}</h2><p className="text-sm text-muted-foreground">{scope === 'mentor' ? `Aluno: ${g.learnerName}` : `Mentor: ${g.mentorName}`}</p>
          <p className="text-sm">{learningStatus[g.status]} · {g.approved}/{g.total} desafios validados</p>
          {g.total > 0 && <progress className="w-full accent-primary" aria-label={`Progresso de ${g.title}`} value={g.approved} max={g.total} />}
        </button>)}
      </section>
      {(goals.data?.length || 0) >= 100 && <p className="text-xs text-muted-foreground">A mostrar os 100 percursos mais recentes.</p>}
    </div>
  </main>;
}
