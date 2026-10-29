import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCommunityAction, type Community } from '../hooks/useAcademiaCommunity';
import { communityLevels } from '../community-links';
export function CreateCohort({ community }: { community: Community }) {
  const save = useCommunityAction(), navigate = useNavigate();
  const [title, setTitle] = useState(''), [plan, setPlan] = useState(''), [challenge, setChallenge] = useState(''), [instructions, setInstructions] = useState(''), [skill, setSkill] = useState('');
  const [capacity, setCapacity] = useState(10), [level, setLevel] = useState('beginner'), [language, setLanguage] = useState('Português'), [locality, setLocality] = useState('Online'), [requirements, setRequirements] = useState('');
  return <form aria-label="Abrir turma" className="rounded-2xl border p-4 space-y-3" onSubmit={async e => {
    e.preventDefault();
    try { const id = await save.mutateAsync({ action: 'cohort_create', payload: { community_slug: community.slug, title: title.trim(), plan: plan.trim(), challenge_title: challenge.trim(), instructions: instructions.trim(), skill: skill.trim(), capacity, level, language: language.trim(), locality: locality.trim(), requirements: requirements.trim() } }); navigate(`/academia/comunidades/${community.slug}/turmas/${id}`); } catch { /* alert below */ }
  }}>
    <h2 className="font-semibold">Abrir uma turma de desafios</h2>
    <p className="text-sm text-muted-foreground">Publica o plano e o primeiro desafio. Cada aluno terá um percurso privado contigo. A entrada nesta turma é gratuita e não utiliza Kumbu.</p>
    <Button type="button" variant="outline" onClick={() => { setTitle(community.starter_title); setChallenge(community.starter_title); setInstructions(community.starter_instructions); setSkill(community.starter_skill); setPlan('Vamos realizar o desafio por etapas. Vou acompanhar as entregas e dar feedback para cada aluno melhorar o trabalho.'); }}>Usar exemplo desta comunidade</Button>
    <label className="block space-y-1"><span>Nome da turma</span><Input required minLength={6} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label className="block space-y-1"><span>Plano de acompanhamento</span><Textarea required minLength={10} maxLength={4000} value={plan} onChange={e => setPlan(e.target.value)} /></label>
    <label className="block space-y-1"><span>Primeiro desafio</span><Input required minLength={3} maxLength={160} value={challenge} onChange={e => setChallenge(e.target.value)} /></label>
    <label className="block space-y-1"><span>O que entregar e como será avaliado</span><Textarea required minLength={3} maxLength={3000} value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
    <label className="block space-y-1"><span>Competência trabalhada</span><Input required minLength={3} maxLength={100} value={skill} onChange={e => setSkill(e.target.value)} /></label>
    <label className="block space-y-1"><span>Vagas de entrada</span><select className="w-full rounded-md border bg-background p-3" value={capacity} onChange={e => setCapacity(Number(e.target.value))}>{[5,10,15,20].map(n => <option key={n}>{n}</option>)}</select></label>
    <label className="block space-y-1"><span>Para quem é a turma</span><select className="w-full rounded-md border bg-background p-3" value={level} onChange={e => setLevel(e.target.value)}>{Object.entries(communityLevels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label className="block space-y-1"><span>Língua de acompanhamento</span><Input required minLength={2} maxLength={60} value={language} onChange={e => setLanguage(e.target.value)} /></label>
    <label className="block space-y-1"><span>Localidade ou online</span><Input required minLength={2} maxLength={100} value={locality} onChange={e => setLocality(e.target.value)} /></label>
    <label className="block space-y-1"><span>Material, ferramentas e condições necessárias</span><Textarea maxLength={1000} value={requirements} onChange={e => setRequirements(e.target.value)} placeholder="Ex.: telemóvel e papel. Explica eventuais materiais necessários." /></label>
    {save.error && <p role="alert" className="text-destructive">{save.error.message}</p>}
    <Button disabled={save.isPending}>{save.isPending ? 'A abrir…' : 'Publicar turma gratuita'}</Button>
  </form>;
}
