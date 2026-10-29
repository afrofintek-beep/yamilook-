import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useIsMentor } from '../hooks/useAcademia';
import { useCommunities, useCommunityCohorts, usePublicWorks } from '../hooks/useAcademiaCommunity';
import { CreateCohort } from '../components/CreateCohort';
import { communityLevels, referralWork } from '../community-links';
export default function AcademiaCommunities() {
  const { slug } = useParams(); const location = useLocation(); const { user } = useAuth();
  const catalog = useCommunities(), cohorts = useCommunityCohorts(slug), works = usePublicWorks(slug), mentor = useIsMentor();
  const [creating,setCreating] = useState(false), [level,setLevel] = useState('all'), [locality,setLocality] = useState('');
  const community = catalog.data?.find(c => c.slug === slug), source = referralWork(location.search);
  const visible = (cohorts.data || []).filter(c => (level === 'all' || c.level === level) && c.locality.toLocaleLowerCase().includes(locality.trim().toLocaleLowerCase()));
  return <main className="h-screen-safe overflow-y-auto bg-background safe-top pb-8">
    <header className="sticky top-0 z-10 border-b bg-background p-3 flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link aria-label="Voltar" to={slug ? '/academia/comunidades' : '/academia'}><ArrowLeft /></Link></Button><h1 className="min-w-0 font-semibold">{community?.title || 'Comunidades da Academia'}</h1></header>
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {catalog.isLoading && <p role="status">A carregar comunidades…</p>}
      {catalog.isError && <p role="alert">Não foi possível carregar as comunidades. <Button variant="link" onClick={() => void catalog.refetch()}>Tentar novamente</Button></p>}
      {!slug && <>
        <section className="rounded-2xl border bg-primary/5 p-5 space-y-3"><Target className="text-primary" /><h2 className="text-2xl font-semibold">Descobre o teu talento. Mostra o que consegues.</h2><p className="text-muted-foreground">Escolhe uma área, encontra um desafio e aprende com quem faz. Podes começar por interesse pessoal, preparar um emprego ou melhorar o teu negócio.</p><Button asChild variant="outline"><Link to="/academia/percursos">Prefiro definir o meu próprio objetivo</Link></Button></section>
        <section aria-label="Áreas de afinidade" className="grid gap-3 sm:grid-cols-2">{catalog.data?.map(c => <Link key={c.slug} to={`/academia/comunidades/${c.slug}`} className="rounded-2xl border p-5 space-y-2 hover:bg-muted/40"><h2 className="font-semibold">{c.title}</h2><p className="text-sm text-muted-foreground">{c.description}</p><p className="text-sm text-primary">Explorar desafios →</p></Link>)}</section>
      </>}
      {slug && !catalog.isLoading && !catalog.isError && !community && <p>Esta comunidade não está disponível.</p>}
      {community && <>
        <section className="space-y-3"><p className="text-muted-foreground">{community.description}</p><div className="rounded-xl border bg-primary/5 p-4 space-y-2"><h2 className="font-semibold">Um resultado para começar</h2><p>{community.starter_title}</p><p className="text-sm text-muted-foreground">{community.starter_instructions}</p></div>
          {user && mentor.data && <Button onClick={() => setCreating(!creating)}>{creating ? 'Fechar formulário' : 'Abrir turma como mentor'}</Button>}
          {!user && <Button asChild variant="outline"><Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>Entrar para participar</Link></Button>}
        </section>
        {creating && mentor.data && <CreateCohort community={community} />}
        <section aria-label="Turmas de desafios" className="space-y-3"><h2 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" />Turmas de desafios</h2><p className="text-sm text-muted-foreground">Um plano comum e acompanhamento privado de cada trabalho. A entrada é gratuita; consulta o material necessário antes de participar.</p>
          <div className="flex flex-wrap gap-3"><label className="space-y-1"><span className="block text-sm">Ponto de partida</span><select className="rounded-md border bg-background p-2" value={level} onChange={e => setLevel(e.target.value)}><option value="all">Todos os níveis</option>{Object.entries(communityLevels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="min-w-0 flex-1 space-y-1"><span className="block text-sm">Localidade ou online</span><Input value={locality} onChange={e => setLocality(e.target.value)} placeholder="Ex.: Online, Luanda, Huambo" /></label></div>
          {cohorts.isLoading && <p role="status">A carregar turmas…</p>}
          {cohorts.isError && <p role="alert">Não foi possível atualizar as turmas. <Button variant="link" onClick={() => void cohorts.refetch()}>Tentar novamente</Button></p>}
          {!cohorts.isLoading && !cohorts.isError && !visible.length && <p className="text-muted-foreground">Ainda não há turmas para esta seleção. Podes explorar outra área ou criar o teu próprio objetivo.</p>}
          {visible.map(c => <Link key={c.id} to={`/academia/comunidades/${c.community_slug}/turmas/${c.id}${source ? `?origem=${source}` : ''}`} className="block rounded-xl border p-4 space-y-2 hover:bg-muted/40"><h3 className="font-semibold break-words">{c.title}</h3><p className="text-sm text-muted-foreground break-words">Mentor: {c.mentor_name} · {communityLevels[c.level]} · {c.language} · {c.locality}</p><p className="text-sm text-primary">{c.status === 'closed' ? 'Inscrições fechadas' : `${c.capacity - c.seats_taken} de ${c.capacity} vagas disponíveis`}</p><span className="text-sm">Conhecer o desafio →</span></Link>)}
        </section>
        <section aria-label="Trabalhos partilhados" className="space-y-3"><h2 className="text-lg font-semibold">O que a comunidade já realizou</h2><p className="text-sm text-muted-foreground">Trabalhos validados e publicados voluntariamente pelos participantes.</p>
          {works.isError && <p role="alert">Não foi possível carregar os trabalhos. <Button variant="link" onClick={() => void works.refetch()}>Tentar novamente</Button></p>}
          {!works.isLoading && !works.isError && !works.data?.length && <p className="text-muted-foreground">Os primeiros trabalhos partilhados aparecerão aqui.</p>}
          {works.data?.map(w => <Link key={w.id} to={`/academia/trabalhos/${w.id}`} className="block rounded-xl border p-4 space-y-2"><h3 className="font-semibold break-words">{w.title}</h3><p className="text-sm break-words">{w.caption}</p><p className="text-xs text-muted-foreground break-words">{w.learner_name} · Validado por {w.mentor_name}</p></Link>)}
        </section>
      </>}
    </div>
  </main>;
}
