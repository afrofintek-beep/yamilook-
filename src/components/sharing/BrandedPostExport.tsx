import FileApplicationPicker from './FileApplicationPicker';
import { prepareOwnedVideoExport } from '@/lib/owned-video-export';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
const DirectLinkedInPublish = lazy(() => import('./DirectLinkedInPublish'));
const LinkedInConnection = lazy(() => import('./DirectLinkedInPublish').then(m => ({ default: m.LinkedInConnection })));
const directLinkedInEnabled = import.meta.env.VITE_LINKEDIN_DIRECT_PUBLISH === 'true';
import { Button } from '@/components/ui/button';
import { getExportIdentity, prepareOwnedPostMedia, getOwnedMediaDescriptor, type ExportIdentity } from '@/lib/owned-post-media';
import { brandImage, brandText } from '@/lib/branded-media';
import { mediaKind } from '../../../shared/owned-post-media.mjs';
import { canShareVideo, sharePreparedVideo } from '../../../shared/post-video-sharing.mjs';

function ExportAction({ id, index, kind, onShared }: { id: string; index: number; kind: string; onShared?: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [compatible, setCompatible] = useState<{ url: string; identity: ExportIdentity; run: typeof import('@/lib/playback-video-export').exportVideoFromPlayback; attempt: number } | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const sourceVideo = useRef<HTMLVideoElement>(null);
  const request = useRef<AbortController | null>(null);
  const file = files[page];
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const prepare = async (usePlayback = false) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(new Error('A preparação demorou demasiado. Tenta um ficheiro mais curto.')), 15 * 60 * 1000);
    setBusy(true); setStatus('A confirmar a autoria…');
    let attempted: { url: string; identity: ExportIdentity } | null = null;
    try {
      // The loaded native player must start in this tap, before authorization awaits.
      const playback = usePlayback && compatible && sourceVideo.current
        ? compatible.run(sourceVideo.current, compatible.identity, controller.signal, progress => setStatus(`A preparar em modo compatível… ${progress}%`)) : null;
      // Observe failures immediately, even while the permission checks are in flight.
      void playback?.catch(() => undefined);
      const identity = await getExportIdentity(id, controller.signal);
      let result: File[];
      if (kind === 'text') result = await brandText(identity, controller.signal);
      else {
        setStatus('A carregar o ficheiro original…');
        const descriptor = await getOwnedMediaDescriptor(id, index, controller.signal);
        attempted = { url: descriptor.url, identity };
        if (kind === 'video') {
          if (playback) {
            if (descriptor.url !== compatible?.url || JSON.stringify(identity) !== JSON.stringify(compatible.identity)) throw new Error('A publicação mudou. Fecha e volta a abrir a partilha.');
            setStatus('A preparar em modo compatível. Mantém esta página visível…');
            result = [await playback];
          } else {
            setStatus('A preparar MP4 com áudio. Mantém esta página aberta…');
            result = [await prepareOwnedVideoExport(id, index, { identity, signal: controller.signal, onProgress: progress => setStatus(`A preparar MP4 com áudio… ${progress}%`) })];
          }
        } else {
          const original = await prepareOwnedPostMedia(id, index, { signal: controller.signal, onProgress: (loaded, total) => setStatus(total ? `A carregar… ${Math.round(100 * loaded / total)}%` : 'A carregar…') });
          result = [await brandImage(original, identity, controller.signal)];
        }
        const current = await getOwnedMediaDescriptor(id, index, controller.signal);
        if (current.url !== descriptor.url) throw new Error('A publicação mudou. Prepara novamente a cópia.');
      }
      const currentIdentity = await getExportIdentity(id, controller.signal);
      if (JSON.stringify(identity) !== JSON.stringify(currentIdentity)) throw new Error('A publicação ou o autor mudou. Prepara novamente a cópia.');
      controller.signal.throwIfAborted();
      setFiles(result); setPage(0); setCompatible(null);
      setStatus('Cópia pronta. Confirma a pré-visualização antes de enviar.');
    } catch (error) {
      if (request.current === controller) {
        if (!controller.signal.aborted && !usePlayback && attempted && error instanceof Error && /decod|unsupported.*codec|codec.*unsupported/i.test(error.message)) {
          const native = await import('@/lib/playback-video-export');
          if (!controller.signal.aborted && request.current === controller && native.playbackExportSupported()) {
            setSourceReady(false); setCompatible({ ...attempted, run: native.exportVideoFromPlayback, attempt: 0 });
            setStatus('A conversão rápida não conseguiu abrir este vídeo. Usa Preparar em modo compatível abaixo.');
          } else setStatus('Este navegador não conseguiu converter o vídeo. Tenta no Safari atualizado.');
        } else {
          controller.abort(); // Stop playback too if authorization or revalidation failed.
          if (usePlayback) { setSourceReady(false); setCompatible(value => value ? { ...value, attempt: value.attempt + 1 } : null); }
          setStatus(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Preparação interrompida. Podes tentar novamente.');
        }
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); if (compatible) { setSourceReady(false); setCompatible(value => value ? { ...value, attempt: value.attempt + 1 } : null); } setStatus('Preparação cancelada.'); };
  const share = async (saving = false) => {
    if (!file || sharing) return;
    setSharing(true);
    try {
      const result = await sharePreparedVideo(file);
      if (result === 'shared') { setStatus(saving ? 'Menu fechado. Confirma que a cópia está nas Fotografias ou em Ficheiros antes de abrir o LinkedIn.' : 'Cópia entregue à aplicação. Conclui o envio lá.'); if (!saving) onShared?.(); }
      else setStatus(result === 'cancelled' ? 'Partilha cancelada. A pré-visualização continua disponível.' : 'Guarda a cópia e anexa-a na aplicação de destino.');
    } catch { setStatus('Não foi possível abrir a partilha. Guarda a cópia e anexa-a na aplicação.'); }
    finally { setSharing(false); }
  };
  return <div className="space-y-3">
    {!file && !compatible && <Button className="w-full" disabled={busy} onClick={() => void prepare()}>Preparar cópia com marca</Button>}
    {!file && compatible && <div className="space-y-3">
      <p className="text-sm">Modo compatível: mantém esta página visível. A preparação demora aproximadamente o tempo do vídeo e preserva o áudio, o logótipo e o autor.</p>
      <video key={compatible.attempt} ref={sourceVideo} crossOrigin="anonymous" src={compatible.url} playsInline controls={!busy} preload="auto" onLoadedMetadata={() => setSourceReady(true)} onError={() => { setSourceReady(false); setStatus('Não foi possível carregar o vídeo original. Fecha e volta a abrir a partilha.'); }} className="max-h-[40svh] w-full rounded-lg bg-black" aria-label="Vídeo original para modo compatível" />
      <Button className="w-full" disabled={busy || !sourceReady} onClick={() => void prepare(true)}>Preparar em modo compatível</Button>
    </div>}
    {busy && <Button variant="outline" className="w-full" onClick={cancel}>Cancelar exportação</Button>}
    {file && preview && <>
      <h4 className="font-medium">Pré-visualização da cópia</h4>
      {files.length > 1 && <label className="block text-sm">Cartão a enviar<select aria-label="Cartão a enviar" value={page} onChange={event => setPage(Number(event.target.value))} className="ml-2 rounded border bg-background p-2">{files.map((_, i) => <option key={i} value={i}>{i + 1} de {files.length}</option>)}</select></label>}
      {file.type.startsWith('video/') ? <video key={preview} src={preview} controls playsInline preload="auto" onError={() => setStatus('Não foi possível reproduzir a pré-visualização. Guarda a cópia para a verificar ou prepara novamente.')} className="max-h-[50svh] w-full rounded-lg bg-black" aria-label="Pré-visualização do vídeo exportado" /> : <img src={preview} alt="Cópia com o logótipo Yamilook e identificação do autor" className="max-h-[50svh] w-full rounded-lg object-contain" />}
      <p className="text-xs text-muted-foreground">{file.type.startsWith('video/') ? 'Reproduz para confirmar também o áudio. ' : ''}{file.name} · {(file.size / 1048576).toFixed(1)} MB</p>
      {!choosing && <Button className="w-full" disabled={sharing} onClick={() => setChoosing(true)}>Confirmar e escolher aplicação</Button>}
      {choosing && <FileApplicationPicker linkedInPublisher={directLinkedInEnabled ? <Suspense fallback={<p>A carregar LinkedIn…</p>}><DirectLinkedInPublish key={preview} file={file} postId={id} /></Suspense> : undefined} downloadUrl={preview} filename={file.name} disabled={sharing} nativeShareAvailable={canShareVideo(file)} onShare={() => void share()} onSave={() => void share(true)} />}
      <Button asChild variant="outline" className="w-full"><a href={preview} download={file.name}>Guardar cópia com marca</a></Button>
      <Button variant="ghost" className="w-full" disabled={sharing} onClick={() => { setFiles([]); setStatus(''); setChoosing(false); }}>Preparar novamente</Button>
    </>}
    <p role="status" aria-live="polite" className="text-sm">{status}</p>
  </div>;
}
export default function BrandedPostExport({ id, mediaUrls, onShared }: { id: string; mediaUrls: string[]; onShared?: () => void }) {
  const media = mediaUrls.flatMap((url, index) => mediaKind(url) ? [{ index, kind: mediaKind(url) as string }] : []);
  const [selection, setSelection] = useState(media[0]?.index ?? -1);
  const selected = media.find(item => item.index === selection) ?? { index: -1, kind: 'text' };
  return <section aria-label="Partilhar com a marca Yamilook" className="mb-5 space-y-3 border-b pb-4">
    <h3 className="font-semibold">Partilhar com a marca Yamilook</h3>
    <p className="text-sm text-muted-foreground">Cria uma cópia com logótipo e autor. Confirma o resultado antes de escolher a aplicação e o destinatário. Quem recebe pode guardar ou reencaminhar a cópia.</p>
    {!!media.length && <label className="block text-sm">Conteúdo a exportar<select className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={selection} onChange={event => setSelection(Number(event.target.value))}>{media.map((item, position) => <option key={item.index} value={item.index}>{item.kind === 'video' ? 'Vídeo' : 'Fotografia'} {position + 1}</option>)}<option value={-1}>Cartão de texto</option></select></label>}
    {selected.kind === 'video' && <p className="text-xs text-muted-foreground">Preparamos uma cópia MP4 mais pequena, com áudio, para enviar noutras aplicações. Vídeos até 10 minutos. Mantém esta página aberta.</p>}
    {directLinkedInEnabled && <Suspense fallback={null}><LinkedInConnection /></Suspense>}
    <ExportAction key={`${id}:${selected.index}:${mediaUrls[selected.index] ?? ''}`} id={id} index={selected.index} kind={selected.kind} onShared={onShared} />
  </section>;
}
