import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCommunities, useOwnWork, useGoalCommunity, useCommunityAction, type PublicWork, type Community } from '../hooks/useAcademiaCommunity';
import type { LearningChallenge } from '../hooks/useAcademiaLearning';
import { shareValidatedWork, workShareUrl } from '../community-links';
function PublicationForm({ challenge, existing, fixedCommunity, communities }: { challenge: LearningChallenge; existing: PublicWork | null; fixedCommunity: string | null; communities: Community[] }) {
  const save = useCommunityAction(); const [caption,setCaption] = useState(existing?.caption || ''), [community,setCommunity] = useState('');
  const [consent,setConsent] = useState(false), [evidence,setEvidence] = useState(false), [message,setMessage] = useState('');
  const slug = existing?.community_slug || fixedCommunity || community;
  return <section className="rounded-xl border border-primary/30 p-3 space-y-3">
    <h4 className="font-semibold">Partilha voluntária do trabalho validado</h4>
    <p className="text-sm text-muted-foreground">A apresentação pública mostra o teu nome, o nome do mentor, o desafio e a competência validada. Escreve o que queres apresentar. As entregas privadas e o feedback ficam no teu percurso.</p>
    {existing?.published && <div className="space-y-2"><a className="block underline text-sm break-all" href={workShareUrl(existing.id)} target="_blank" rel="noopener noreferrer">Ver a apresentação pública</a><Button variant="outline" disabled={save.isPending} onClick={async () => { try { setMessage(await shareValidatedWork(existing.id,existing.title)); } catch { setMessage('Não foi possível copiar. Usa a ligação da apresentação pública.'); } }}>Partilhar ligação</Button><Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ action:'work_hide',targetId:existing.id })}>Retirar da apresentação pública</Button><p className="text-xs text-muted-foreground">Podes retirar esta página da Academia. Quem recebeu conteúdo ou ficheiros fora da aplicação pode conservar uma cópia.</p></div>}
    <form aria-label={`Publicar ${challenge.title}`} className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate({ action:'work_publish',targetId:challenge.id,payload:{caption:caption.trim(),community_slug:slug,consent,include_evidence:evidence} }); }}>
      <p className="text-sm break-words"><strong>{challenge.title}</strong> · {challenge.skill}</p>
      <label className="block space-y-1"><span className="text-sm">Comunidade da apresentação</span><select required className="w-full rounded-md border bg-background p-2" value={slug} disabled={!!fixedCommunity || !!existing} onChange={e => setCommunity(e.target.value)}><option value="">Escolhe uma comunidade</option>{communities.map(c => <option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label>
      <label className="block space-y-1"><span className="text-sm">O que queres mostrar sobre o teu trabalho?</span><Textarea required minLength={3} maxLength={1000} value={caption} onChange={e => setCaption(e.target.value)} /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={evidence} onChange={e => setEvidence(e.target.checked)} />Incluir a ligação do ficheiro que o mentor validou, se existir. Confirmei que pode ser partilhada publicamente.</label>
      <label className="flex items-start gap-2 text-sm"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Quero tornar públicos esta apresentação, o meu nome e o nome do mentor.</label>
      <Button disabled={save.isPending || !consent || !slug || caption.trim().length<3}>{save.isPending?'A publicar…':existing?.published?'Atualizar apresentação pública':'Publicar apresentação'}</Button>
    </form>
    {save.error && <p role="alert" className="text-destructive text-sm">{save.error.message}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
function PublicationComposer({ challenge }: { challenge: LearningChallenge }) {
  const catalog = useCommunities(), own = useOwnWork(challenge.id), goalCommunity = useGoalCommunity(challenge.goal_id);
  if (catalog.isLoading || own.isLoading || goalCommunity.isLoading) return <p role="status">A preparar a apresentação…</p>;
  if (catalog.isError || own.isError || goalCommunity.isError) return <p role="alert">Não foi possível preparar a apresentação. <Button variant="link" onClick={() => { void catalog.refetch();void own.refetch();void goalCommunity.refetch(); }}>Tentar novamente</Button></p>;
  return <PublicationForm key={`${own.data?.id || 'new'}-${own.data?.published}`} challenge={challenge} communities={catalog.data || []} existing={own.data || null} fixedCommunity={goalCommunity.data || null} />;
}
export function ShareValidatedWork({ challenge }: { challenge: LearningChallenge }) {
  const [open,setOpen] = useState(false);
  return <div className="space-y-3"><Button variant="outline" onClick={() => setOpen(!open)}>{open?'Fechar partilha':'Partilhar este trabalho'}</Button>{open && <PublicationComposer challenge={challenge} />}</div>;
}
