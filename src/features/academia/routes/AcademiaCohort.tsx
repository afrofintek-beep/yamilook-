import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useCohort, useCohortMembers, useCommunityAction, type Cohort } from '../hooks/useAcademiaCommunity';
import { communityLevels, referralWork } from '../community-links';
function CohortParticipation({ cohort }: { cohort: Cohort }) {
  useUiLocale();
  const { user, profile, loading } = useAuth(), location = useLocation(), navigate = useNavigate();
  const isMentor = cohort.mentor_id === user?.id, members = useCohortMembers(cohort.id,isMentor), save = useCommunityAction();
  const own = members.data?.find(m => m.learner_id === user?.id), next = encodeURIComponent(location.pathname + location.search);
  if (loading) return <p role="status">{uiText("A verificar a conta…")}</p>;
  if (!user) return <div className="space-y-3"><Button asChild><Link to={`/login?next=${next}`}>{cohort.status !== 'open' || cohort.seats_taken >= cohort.capacity ? uiText("Entrar para ver a minha participação") : uiText("Entrar para participar gratuitamente")}</Link></Button>{(cohort.status !== 'open' || cohort.seats_taken >= cohort.capacity) && <Button asChild variant="outline"><Link to={`/academia/comunidades/${cohort.community_slug}`}>{uiText("Explorar outras turmas")}</Link></Button>}</div>;
  if (!profile?.onboarding_completed) return <Button asChild><Link to={`/onboarding?next=${next}`}>{uiText("Completar o perfil para participar")}</Link></Button>;
  return <section className="space-y-4">
    {members.isLoading && <p role="status">{uiText("A carregar a tua participação…")}</p>}
    {members.isError && <p role="alert">{uiText("Não foi possível atualizar a participação. ")}<Button variant="link" onClick={() => void members.refetch()}>{uiText("Tentar novamente")}</Button></p>}
    {own && <Button asChild><Link to={`/academia/percursos/${own.goal_id}`}>{uiText("Abrir o meu percurso privado")}</Link></Button>}
    {!own && !isMentor && !members.isLoading && !members.isError && <>
      <p className="text-sm text-muted-foreground">{uiText("Ao participar, partilhas o teu nome e as entregas com este mentor. Os colegas não verão o teu percurso. As vagas são contabilizadas por entrada; os trabalhos e o histórico mantêm-se no teu percurso.")}</p>
      <Button disabled={save.isPending || cohort.status !== 'open' || cohort.seats_taken >= cohort.capacity} onClick={async () => {
        try { const id = await save.mutateAsync({ action: 'cohort_join', targetId: cohort.id, payload: { source_work_id: referralWork(location.search) || null } }); navigate(`/academia/percursos/${id}`); } catch { /* alert below */ }
      }}>{save.isPending ? uiText("A entrar…") : cohort.status !== 'open' || cohort.seats_taken >= cohort.capacity ? uiText("Inscrições encerradas") : uiText("Participar gratuitamente")}</Button>
    </>}
    {isMentor && <>
      <h2 className="font-semibold">{uiText("Acompanhamento da turma")}</h2>
      <p className="text-sm">{uiText("{{value1}} participantes · {{value2}} desafios validados · {{value3}} entradas por partilha", { value1: (members.data?.length || 0) ?? "", value2: ((members.data || []).reduce((n,m) => n + Number(m.progress?.approved || 0),0)) ?? "", value3: (members.data?.filter(m => m.source_work_id).length || 0) ?? "" })}</p>
      <p className="text-xs text-muted-foreground">{uiText("A lista e os percursos só estão disponíveis para ti e para cada aluno respetivo.")}</p>
      <ul className="space-y-2">{members.data?.map(m => <li key={m.id}><Link className="block rounded-xl border p-3 text-sm break-words underline" to={`/academia/percursos/${m.goal_id}`}>{uiText("{{value1}} · {{value2}}/{{value3}} desafios validados", { value1: (m.name) ?? "", value2: (Number(m.progress?.approved || 0)) ?? "", value3: (Number(m.progress?.total || 0)) ?? "" })}</Link></li>)}</ul>
      {cohort.status === 'open' && <><p className="text-sm text-muted-foreground">{uiText("Fechar as inscrições mantém os percursos já iniciados disponíveis.")}</p><Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ action: 'cohort_close', targetId: cohort.id })}>{uiText("Fechar inscrições")}</Button></>}
    </>}
    {save.error && <p role="alert" className="text-destructive">{save.error.message}</p>}
  </section>;
}
export default function AcademiaCohort() {
  useUiLocale();
  const { cohortId, slug } = useParams(); const client = useQueryClient(); const query = useCohort(cohortId); const cohort = query.data;
  const matches = cohort?.community_slug === slug;
  return <main className="h-screen-safe overflow-y-auto bg-background safe-top pb-8">
    <header className="sticky top-0 z-10 bg-background border-b p-3 flex items-center gap-2"><Button asChild variant="ghost" size="icon"><Link to={`/academia/comunidades/${slug || ''}`} aria-label={uiText("Voltar à comunidade")}><ArrowLeft /></Link></Button><h1 className="font-semibold">{uiText("Turma de desafios")}</h1><Button className="ml-auto" variant="outline" disabled={query.isFetching} onClick={() => void client.invalidateQueries({queryKey:['academia-communities']})}>{uiText("Atualizar")}</Button></header>
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      {query.isLoading && <p role="status">{uiText("A carregar turma…")}</p>}
      {query.isError && <p role="alert">{uiText("Não foi possível carregar a turma. Tenta atualizar.")}</p>}
      {!query.isLoading && !query.isError && !matches && <p>{uiText("Esta turma não está disponível nesta comunidade.")}</p>}
      {cohort && matches && <>
        <section className="space-y-2"><h2 className="text-xl font-semibold break-words">{cohort.title}</h2><p className="text-sm text-muted-foreground break-words">{uiText("Com {{value1}} · {{value2}} · {{value3}} · {{value4}}", { value1: (cohort.mentor_name) ?? "", value2: (communityLevels[cohort.level]) ?? "", value3: (cohort.language) ?? "", value4: (cohort.locality) ?? "" })}</p><p className="text-primary text-sm">{uiText("{{value1}} · Entrada gratuita", { value1: (cohort.status === 'open' ? uiText("{{value1}}/{{value2}} vagas", { value1: cohort.capacity - cohort.seats_taken, value2: cohort.capacity }) : uiText("Inscrições fechadas")) ?? "" })}</p></section>
        <section className="rounded-xl bg-primary/5 p-4 space-y-2"><h2 className="font-semibold">{uiText("Plano de acompanhamento")}</h2><p className="whitespace-pre-wrap break-words text-sm">{cohort.plan}</p></section>
        <section className="rounded-xl border p-4 space-y-2"><h2 className="font-semibold break-words">{uiText("Primeiro desafio: {{value1}}", { value1: (cohort.challenge_title) ?? "" })}</h2><p className="whitespace-pre-wrap break-words text-sm">{cohort.instructions}</p><p className="text-sm text-muted-foreground break-words">{uiText("Competência trabalhada: {{value1}}", { value1: (cohort.skill) ?? "" })}</p></section>
        <section className="space-y-2"><h2 className="font-semibold">{uiText("O que precisas para participar")}</h2><p className="text-sm whitespace-pre-wrap break-words">{cohort.requirements || uiText("O mentor não indicou materiais adicionais. Podes confirmar as condições com o mentor antes de realizar o trabalho.")}</p><p className="text-sm text-muted-foreground">{uiText("As entregas podem ser feitas por texto e ligação para o trabalho. Não precisas de manter uma chamada de vídeo aberta.")}</p></section>
        <CohortParticipation cohort={cohort} />
      </>}
    </div>
  </main>;
}
