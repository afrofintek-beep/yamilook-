import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicWork } from '../hooks/useAcademiaCommunity';
import { safeEvidenceUrl } from '../learning-evidence';
import { shareValidatedWork } from '../community-links';
export default function AcademiaPublicWork() {
  useUiLocale();
  const { workId } = useParams(); const query = usePublicWork(workId); const work = query.data; const [message,setMessage] = useState('');
  const link = safeEvidenceUrl(work?.evidence_url || null);
  return <main className="h-screen-safe overflow-y-auto bg-background safe-top pb-8">
    <header className="sticky top-0 z-10 bg-background border-b p-3 flex items-center gap-2"><Button asChild variant="ghost" size="icon"><Link to={work?`/academia/comunidades/${work.community_slug}`:'/academia/comunidades'} aria-label={uiText("Explorar a comunidade")}><ArrowLeft /></Link></Button><h1 className="font-semibold">{uiText("Mostro o que aprendi")}</h1></header>
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      {query.isLoading && <p role="status">{uiText("A carregar trabalho…")}</p>}
      {query.isError && <p role="alert">{uiText("Não foi possível carregar a apresentação. ")}<Button variant="link" onClick={() => void query.refetch()}>{uiText("Tentar novamente")}</Button></p>}
      {!query.isLoading && !query.isError && !work && <section className="space-y-3"><p>{uiText("Esta apresentação não está disponível publicamente.")}</p><Button asChild><Link to="/academia/comunidades">{uiText("Explorar desafios")}</Link></Button></section>}
      {work && <>
        <article className="rounded-2xl border bg-primary/5 p-5 space-y-4"><CheckCircle2 className="text-primary" /><h2 className="text-2xl font-semibold break-words">{work.title}</h2><p className="text-sm break-words">{uiText("Realizado por ")}<strong>{work.learner_name}</strong></p><p className="whitespace-pre-wrap break-words">{work.caption}</p><p className="text-sm break-words">{uiText("Competência demonstrada: ")}{work.skill}</p><p className="text-sm text-muted-foreground break-words">{uiText("Trabalho validado por ")}{work.mentor_name}{uiText(" na Academia.")}</p>{link && <a className="block underline text-sm break-words" href={link} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{uiText("Abrir o ficheiro partilhado")}</a>}<p className="text-xs text-muted-foreground">{uiText("Apresentação publicada voluntariamente pelo participante. A validação do trabalho não equivale a uma certificação profissional acreditada.")}</p></article>
        <div className="flex flex-wrap gap-3"><Button asChild><Link to={work.cohort_id?`/academia/comunidades/${work.community_slug}/turmas/${work.cohort_id}?origem=${work.id}`:`/academia/comunidades/${work.community_slug}?origem=${work.id}`}>{uiText("Quero aprender também")}</Link></Button><Button variant="outline" onClick={async () => { try { setMessage(await shareValidatedWork(work.id,work.title)); } catch { setMessage(uiText("Não foi possível preparar a partilha. Podes copiar a ligação desta página.")); } }}>{uiText("Partilhar apresentação")}</Button></div>
        {message && <p role="status">{message}</p>}
      </>}
    </div>
  </main>;
}
