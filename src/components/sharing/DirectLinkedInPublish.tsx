import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { connectLinkedIn, linkedinRequest } from '@/lib/linkedin-publishing';

function useConnection() {
  const [connection, setConnection] = useState<{ enabled: boolean; connected: boolean; name?: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void linkedinRequest('status', undefined, undefined, controller.signal).then(setConnection).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  return { connection, setConnection, error, setError };
}
export function LinkedInConnection() {
  const { connection, setConnection, error, setError } = useConnection();
  const [busy, setBusy] = useState(false);
  const act = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (connection?.connected) { await linkedinRequest('disconnect'); setConnection({ enabled: true, connected: false }); }
      else await connectLinkedIn();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível ligar ao LinkedIn.'); }
    finally { setBusy(false); }
  };
  if (connection?.enabled === false) return null;
  return <section className="space-y-2 rounded-xl border p-3" aria-label="Conta LinkedIn">
    <p className="text-sm">{connection?.connected ? `LinkedIn ligado: ${connection.name}` : 'Liga a tua conta LinkedIn antes de preparar a cópia. A autorização abre o LinkedIn e regressa à Yamilook.'}</p>
    <Button variant="outline" disabled={busy || !connection} onClick={() => void act()}>{connection?.connected ? 'Desligar conta LinkedIn' : 'Ligar conta LinkedIn'}</Button>
    <p role="status" className="text-sm">{error}</p>
  </section>;
}
export default function DirectLinkedInPublish({ file, postId }: { file: File; postId: string }) {
  const { connection, error: connectionError, setError: setConnectionError } = useConnection();
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState('idle');
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [published, setPublished] = useState('');
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const prepare = async () => {
    if (busy.current || draft) return;
    busy.current = true; setPhase('uploading'); setMessage('A carregar a cópia com marca para o LinkedIn…');
    const abort = new AbortController(); controller.current = abort;
    try {
      const job = await linkedinRequest('initialize', { postId, type: file.type, size: file.size }, undefined, abort.signal);
      setDraft(job.id);
      for (let i = 0; i < job.parts.length; i++) {
        const part = job.parts[i];
        await linkedinRequest('upload', undefined, { draft: job.id, part: i, blob: file.slice(part.firstByte, part.lastByte + 1) }, abort.signal);
        setMessage(`A carregar para o LinkedIn… ${Math.round(100 * (i + 1) / job.parts.length)}%`);
      }
      const result = await linkedinRequest('finalize', { draft: job.id }, undefined, abort.signal);
      setPhase(result.status); setMessage(result.status === 'ready' ? 'Cópia carregada. Revê o texto e confirma a publicação.' : 'O LinkedIn está a processar o vídeo. Verifica quando estiver pronto.');
    } catch (e) { if (!abort.signal.aborted) { setPhase('failed'); setMessage(e instanceof Error ? e.message : 'O envio falhou.'); } }
    finally { busy.current = false; }
  };
  const check = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await linkedinRequest('draft', { draft });
      setPhase(result.status); if (result.postId) setPublished(result.postId);
      setMessage(result.status === 'ready' ? 'Cópia pronta. Confirma a publicação.' : result.status === 'published' ? 'Publicado no LinkedIn.' : result.status === 'processing' ? 'O LinkedIn ainda está a processar o vídeo.' : 'Verifica o teu LinkedIn antes de criar outra publicação.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível confirmar o resultado.'); }
    finally { busy.current = false; }
  };
  const publish = async () => {
    if (busy.current || phase !== 'ready' || !confirmed) return;
    busy.current = true; setPhase('publishing'); setMessage('A publicar no LinkedIn…');
    try {
      const result = await linkedinRequest('publish', { draft, commentary: text, visibility, confirm: true });
      setPublished(result.postId); setPhase('published'); setMessage('Publicado no LinkedIn.');
    } catch (e) {
      setPhase('uncertain'); setMessage(e instanceof Error ? e.message : 'Não foi possível confirmar o resultado. Verifica o LinkedIn.');
    } finally { busy.current = false; }
  };
  if (connection?.enabled === false) return null;
  return <section className="space-y-3 rounded-xl border border-primary p-3" aria-label="Publicar diretamente no LinkedIn">
    <h4 className="font-semibold">Publicar com as artes Yamilook</h4>
    {!connection?.connected ? <>
      <p className="text-sm">Liga a conta antes de enviar. Ao regressares, volta a preparar a cópia desta publicação.</p>
      <Button disabled={!connection} onClick={() => void connectLinkedIn().catch(e => setConnectionError(e.message))}>Ligar conta LinkedIn</Button>
    </> : <>
      <p className="text-sm">Conta: {connection.name}. Será enviado o ficheiro da pré-visualização acima, com logótipo e autor.</p>
      <label className="block text-sm">Texto da publicação<textarea className="mt-1 w-full rounded border bg-background p-2" maxLength={3000} rows={4} value={text} disabled={['publishing', 'published', 'uncertain'].includes(phase)} onChange={e => { setText(e.target.value); setConfirmed(false); }} /></label>
      <label className="block text-sm">Quem pode ver no LinkedIn<select className="ml-2 rounded border bg-background p-2" value={visibility} disabled={['publishing', 'published', 'uncertain'].includes(phase)} onChange={e => { setVisibility(e.target.value); setConfirmed(false); }}><option value="PUBLIC">Todos</option><option value="CONNECTIONS">As minhas ligações</option></select></label>
      {phase === 'idle' && <Button className="w-full" onClick={() => void prepare()}>Carregar arte para LinkedIn</Button>}
      {phase === 'processing' && <Button onClick={() => void check()}>Verificar processamento</Button>}
      {phase === 'ready' && <>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo o ficheiro, o texto e o público. Autorizo esta publicação no LinkedIn.</label>
        <Button className="w-full" disabled={!confirmed} onClick={() => void publish()}>Confirmar e publicar no LinkedIn</Button>
      </>}
      {['uncertain', 'publishing'].includes(phase) && <Button variant="outline" onClick={() => void check()}>Verificar resultado</Button>}
      {phase === 'failed' && <p className="text-sm">O envio não foi concluído. Fecha e prepara novamente a cópia.</p>}
      {published && /^urn:li:(share|ugcPost):\d+$/.test(published) && <a className="block underline" href={`https://www.linkedin.com/feed/update/${encodeURIComponent(published)}/`} target="_blank" rel="noopener noreferrer">Ver publicação no LinkedIn</a>}
    </>}
    <p role="status" aria-live="polite" className="text-sm">{connectionError || message}</p>
  </section>;
}
