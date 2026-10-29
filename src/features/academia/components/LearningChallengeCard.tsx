import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { learningStatus, useLearningAction, type LearningChallenge, type LearningSubmission } from '../hooks/useAcademiaLearning';
import { safeEvidenceUrl } from '../learning-evidence';
export function LearningChallengeCard({ challenge, submissions, goalId, isMentor, active }: {
  challenge: LearningChallenge; submissions: LearningSubmission[]; goalId: string; isMentor: boolean; active: boolean;
}) {
  const save = useLearningAction(); const [content, setContent] = useState(''); const [url, setUrl] = useState(''); const [feedback, setFeedback] = useState('');
  return <article className="rounded-xl border p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold break-words">{challenge.title}</h3><span className="text-sm text-primary">{learningStatus[challenge.status]}</span></div>
    <p className="text-sm whitespace-pre-wrap break-words">{challenge.instructions}</p>
    <p className="text-xs text-muted-foreground">Competência trabalhada: {challenge.skill}</p>
    {submissions.map((s, index) => {
      const link = safeEvidenceUrl(s.evidence_url);
      return <section key={s.id} aria-label={`Entrega ${submissions.length - index}`} className="rounded-lg bg-muted/40 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Entrega {submissions.length - index} · {new Date(s.created_at).toLocaleString('pt-AO')} · {learningStatus[s.status]}</p>
        <p className="text-sm whitespace-pre-wrap break-words">{s.content}</p>
        {link && <a className="text-sm underline" href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir trabalho partilhado</a>}
        {s.feedback && <p className="text-sm whitespace-pre-wrap break-words"><strong>Feedback do mentor: </strong>{s.feedback}</p>}
        {active && isMentor && s.status === 'pending' && challenge.status === 'submitted' && <form aria-label={`Avaliar ${challenge.title}`} className="space-y-2" onSubmit={e => e.preventDefault()}>
          <label className="block space-y-1"><span className="text-sm">Feedback para o aluno</span><Textarea required minLength={3} maxLength={3000} value={feedback} onChange={e => setFeedback(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2">{(['revision', 'approved'] as const).map(decision => <Button key={decision} type="button" variant={decision === 'approved' ? 'default' : 'outline'} disabled={save.isPending || feedback.trim().length < 3} onClick={() => save.mutate({ action: 'review', goalId, payload: { challenge_id: challenge.id, submission_id: s.id, decision, feedback: feedback.trim() } }, { onSuccess: () => setFeedback('') })}>
            {decision === 'approved' ? 'Validar trabalho' : 'Pedir revisão'}
          </Button>)}</div>
        </form>}
      </section>;
    })}
    {active && !isMentor && ['open', 'revision'].includes(challenge.status) && <form aria-label={`Entregar ${challenge.title}`} className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      try { await save.mutateAsync({ action: 'submit', goalId, payload: { challenge_id: challenge.id, content: content.trim(), evidence_url: url.trim() } }); setContent(''); setUrl(''); } catch { /* alert below */ }
    }}>
      <label className="block space-y-1"><span className="text-sm">Descreve o trabalho que realizaste</span><Textarea required minLength={3} maxLength={4000} value={content} onChange={e => setContent(e.target.value)} /></label>
      <label className="block space-y-1"><span className="text-sm">Ligação para o trabalho (opcional)</span><Input type="url" pattern="https://.*" maxLength={2000} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">Podes incluir uma ligação para uma fotografia, vídeo ou documento. Confirma que o mentor tem acesso ao ficheiro.</p>
      <Button disabled={save.isPending || content.trim().length < 3}>{save.isPending ? 'A enviar…' : challenge.status === 'revision' ? 'Enviar nova versão' : 'Entregar trabalho'}</Button>
    </form>}
    {save.error && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
  </article>;
}
