import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { isVideo } from '../../../shared/public-post.mjs';
import { canShareVideo, preparePostVideo, sharePreparedVideo, videoEndpoint } from '../../../shared/post-video-sharing.mjs';

function VideoFileActions({ id, index, onShared }: { id: string; index: number; onShared?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const prepare = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    setBusy(true); setStatus('A preparar vídeo…');
    try {
      const result = await preparePostVideo(id, index, { signal: controller.signal, onProgress: (loaded: number, total: number) => setStatus(total ? `A preparar vídeo… ${Math.min(100, Math.round(loaded / total * 100))}%` : `A preparar vídeo… ${(loaded / 1048576).toFixed(1)} MB`) });
      if (!controller.signal.aborted) { setFile(result); setStatus(canShareVideo(result) ? 'Vídeo pronto. Toca em Escolher aplicação.' : 'Este navegador não partilha ficheiros diretamente. Descarrega o vídeo para o publicar.'); }
    } catch (failure) {
      if (request.current === controller) setStatus(controller.signal.aborted ? 'Preparação interrompida. Tenta novamente ou descarrega o vídeo.' : failure instanceof Error ? failure.message : 'Não foi possível preparar o vídeo.');
    } finally { window.clearTimeout(timeout); if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  const share = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const result = await sharePreparedVideo(file);
      if (result === 'shared') { setStatus('Vídeo entregue à aplicação. Conclui a publicação nessa aplicação.'); onShared?.(); }
      else if (result === 'unsupported') setStatus('Descarrega o vídeo e anexa-o numa publicação.');
      else setStatus('Partilha cancelada. O vídeo continua pronto.');
    } catch { setStatus('Não foi possível abrir a partilha. Tenta novamente ou descarrega o vídeo.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    {!file ? <Button className="w-full" disabled={busy} onClick={() => void prepare()}>{busy ? 'A preparar vídeo…' : 'Partilhar vídeo'}</Button> : canShareVideo(file) ? <Button className="w-full" disabled={busy} onClick={() => void share()}>Escolher aplicação</Button> : null}
    {busy && request.current && <Button variant="ghost" className="w-full" onClick={() => request.current?.abort()}>Cancelar preparação</Button>}
    <Button asChild variant="outline" className="w-full"><a href={videoEndpoint(id, index, true)} target="_blank" rel="noopener noreferrer">Descarregar vídeo</a></Button>
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
  </div>;
}
export default function PostVideoShare({ id, mediaUrls, onShared }: { id: string; mediaUrls: string[]; onShared?: () => void }) {
  const videos = mediaUrls.flatMap((url, index) => isVideo(url) ? [index] : []);
  const [selection, setSelection] = useState(videos[0]);
  if (!videos.length) return null;
  const index = videos.includes(selection) ? selection : videos[0];
  return <section className="mb-5 space-y-3 border-b pb-4" aria-label="Partilhar ficheiro de vídeo">
    <h3 className="font-semibold">Partilhar vídeo</h3>
    <p className="text-sm text-muted-foreground">Envia o ficheiro às aplicações compatíveis. Se o LinkedIn não aparecer, descarrega o vídeo e anexa-o numa publicação.</p>
    {videos.length > 1 && <label className="block text-sm">Vídeo a partilhar<select className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={index} onChange={event => setSelection(Number(event.target.value))}>{videos.map((value, position) => <option key={value} value={value}>Vídeo {position + 1}</option>)}</select></label>}
    <VideoFileActions key={`${id}:${index}`} id={id} index={index} onShared={onShared} />
  </section>;
}
