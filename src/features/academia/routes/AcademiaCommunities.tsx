import { useTranslation } from 'react-i18next';
import { localizeCommunity } from '../public-copy';
import { AcademiaLanguageSelector } from '../components/AcademiaLanguageSelector';
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
  const { t } = useTranslation();
  const { slug } = useParams(); const location = useLocation(); const { user } = useAuth();
  const catalog = useCommunities(), cohorts = useCommunityCohorts(slug), works = usePublicWorks(slug), mentor = useIsMentor();
  const [creating,setCreating] = useState(false), [level,setLevel] = useState('all'), [locality,setLocality] = useState('');
  const communities = catalog.data?.map(c => localizeCommunity(c, t));
  const community = communities?.find(c => c.slug === slug), source = referralWork(location.search);
  const visible = (cohorts.data || []).filter(c => (level === 'all' || c.level === level) && c.locality.toLocaleLowerCase().includes(locality.trim().toLocaleLowerCase()));
  return <main className="h-screen-safe overflow-y-auto bg-background safe-top pb-8">
    <header className="sticky top-0 z-10 border-b bg-background p-3 flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link aria-label={t('academiaPublic.back')} to={slug ? '/academia/comunidades' : '/academia'}><ArrowLeft className="rtl:rotate-180" /></Link></Button><h1 className="min-w-0 flex-1 font-semibold break-words">{community?.title || t('academiaPublic.title')}</h1><AcademiaLanguageSelector /></header>
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {catalog.isLoading && <p role="status">{t('academiaPublic.loadingCommunities')}</p>}
      {catalog.isError && <p role="alert">{t('academiaPublic.communitiesError')} <Button variant="link" onClick={() => void catalog.refetch()}>{t('academiaPublic.retry')}</Button></p>}
      {!slug && <>
        <section className="rounded-2xl border bg-primary/5 p-5 space-y-3"><Target className="text-primary" /><h2 className="text-2xl font-semibold">{t('academiaPublic.heroTitle')}</h2><p className="text-muted-foreground">{t('academiaPublic.heroBody')}</p><Button asChild variant="outline" className="h-auto whitespace-normal text-start py-2"><Link to="/academia/percursos">{t('academiaPublic.ownGoal')}</Link></Button></section>
        <section aria-label={t('academiaPublic.areas')} className="grid gap-3 sm:grid-cols-2">{communities?.map(c => <Link key={c.slug} to={`/academia/comunidades/${c.slug}`} className="rounded-2xl border p-5 space-y-2 hover:bg-muted/40"><h2 className="font-semibold">{c.title}</h2><p className="text-sm text-muted-foreground">{c.description}</p><p className="text-sm text-primary">{t('academiaPublic.explore')} <span className="inline-block rtl:rotate-180">→</span></p></Link>)}</section>
      </>}
      {slug && !catalog.isLoading && !catalog.isError && !community && <p>{t('academiaPublic.unavailable')}</p>}
      {community && <>
        <section className="space-y-3"><p className="text-muted-foreground">{community.description}</p><div className="rounded-xl border bg-primary/5 p-4 space-y-2"><h2 className="font-semibold">{t('academiaPublic.starter')}</h2><p>{community.starter_title}</p><p className="text-sm text-muted-foreground">{community.starter_instructions}</p></div>
          {user && mentor.data && <Button onClick={() => setCreating(!creating)}>{creating ? t('academiaPublic.closeForm') : t('academiaPublic.openCohort')}</Button>}
          {!user && <Button asChild variant="outline"><Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>{t('academiaPublic.signIn')}</Link></Button>}
        </section>
        {creating && mentor.data && <CreateCohort community={community} />}
        <section aria-label={t('academiaPublic.cohorts')} className="space-y-3"><h2 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" />{t('academiaPublic.cohorts')}</h2><p className="text-sm text-muted-foreground">{t('academiaPublic.cohortsBody')}</p>
          <div className="flex flex-wrap gap-3"><label className="min-w-0 max-w-full space-y-1"><span className="block text-sm">{t('academiaPublic.level')}</span><select className="max-w-full rounded-md border bg-background p-2" value={level} onChange={e => setLevel(e.target.value)}><option value="all">{t('academiaPublic.allLevels')}</option>{Object.entries(communityLevels).map(([id,label]) => <option key={id} value={id}>{t(`academiaPublic.levels.${id}`, { defaultValue: label })}</option>)}</select></label><label className="min-w-0 flex-1 space-y-1"><span className="block text-sm">{t('academiaPublic.locality')}</span><Input value={locality} onChange={e => setLocality(e.target.value)} placeholder={t('academiaPublic.localityPlaceholder')} /></label></div>
          {cohorts.isLoading && <p role="status">{t('academiaPublic.loadingCohorts')}</p>}
          {cohorts.isError && <p role="alert">{t('academiaPublic.cohortsError')} <Button variant="link" onClick={() => void cohorts.refetch()}>{t('academiaPublic.retry')}</Button></p>}
          {!cohorts.isLoading && !cohorts.isError && !visible.length && <p className="text-muted-foreground">{t('academiaPublic.noCohorts')}</p>}
          {visible.map(c => <Link key={c.id} to={`/academia/comunidades/${c.community_slug}/turmas/${c.id}${source ? `?origem=${source}` : ''}`} className="block rounded-xl border p-4 space-y-2 hover:bg-muted/40"><h3 className="font-semibold break-words">{c.title}</h3><p className="text-sm text-muted-foreground break-words">{t('academiaPublic.mentor')}: {c.mentor_name} · {t(`academiaPublic.levels.${c.level}`, { defaultValue: communityLevels[c.level] })} · {c.language} · {c.locality}</p><p className="text-sm text-primary">{c.status === 'closed' ? t('academiaPublic.closed') : t('academiaPublic.seats', { available: c.capacity - c.seats_taken, capacity: c.capacity })}</p><span className="text-sm">{t('academiaPublic.viewChallenge')} <span className="inline-block rtl:rotate-180">→</span></span></Link>)}
        </section>
        <section aria-label={t('academiaPublic.sharedWorks')} className="space-y-3"><h2 className="text-lg font-semibold">{t('academiaPublic.worksTitle')}</h2><p className="text-sm text-muted-foreground">{t('academiaPublic.worksBody')}</p>
          {works.isError && <p role="alert">{t('academiaPublic.worksError')} <Button variant="link" onClick={() => void works.refetch()}>{t('academiaPublic.retry')}</Button></p>}
          {!works.isLoading && !works.isError && !works.data?.length && <p className="text-muted-foreground">{t('academiaPublic.noWorks')}</p>}
          {works.data?.map(w => <Link key={w.id} to={`/academia/trabalhos/${w.id}`} className="block rounded-xl border p-4 space-y-2"><h3 className="font-semibold break-words">{w.title}</h3><p className="text-sm break-words">{w.caption}</p><p className="text-xs text-muted-foreground break-words">{w.learner_name} · {t('academiaPublic.validatedBy', { mentor: w.mentor_name })}</p></Link>)}
        </section>
      </>}
    </div>
  </main>;
}
