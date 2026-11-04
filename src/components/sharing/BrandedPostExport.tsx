import FileApplicationPicker from './FileApplicationPicker';
import { prepareOwnedVideoExport } from '@/lib/owned-video-export';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getExportIdentity, prepareOwnedPostMedia, getOwnedMediaDescriptor } from '@/lib/owned-post-media';
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
  const request = useRef<AbortController | null>(null);
  const file = files[page];
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const prepare = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(new Error('A preparação demorou demasiado. Tenta um ficheiro mais curto.')), 15 * 60 * 1000);
    setBusy(true); setStatus('A confirmar a autoria…');
    try {
      const identity = await getExportIdentity(id, controller.signal);
      let result: File[];
      if (kind === 'text') result = await brandText(identity, controller.signal);
      else {
        setStatus('A carregar o ficheiro original…');
        const descriptor = await getOwnedMediaDescriptor(id, index, controller.signal);
        if (kind === 'video') {
          setStatus('A preparar MP4 com áudio. Mantém esta página aberta…');
          result = [await prepareOwnedVideoExport(id, index, { identity, signal: controller.signal, onProgress: progress => setStatus(`A preparar MP4 com áudio… ${progress}%`) })];
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
      setFiles(result); setPage(0);
      setStatus('Cópia pronta. Confirma a pré-visualização antes de enviar.');
    } catch (error) {
      if (request.current === controller) setStatus(controller.signal.aborted ? 'Preparação interrompida. Podes tentar novamente.' : error instanceof Error ? error.message : 'Não foi possível exportar. Usa o ficheiro original abaixo.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); setStatus('Preparação cancelada.'); };
  const share = async () => {
    if (!file || sharing) return;
    setSharing(true);
    try {
      const result = await sharePreparedVideo(file);
      if (result === 'shared') { setStatus('Cópia entregue à aplicação. Conclui o envio lá.'); onShared?.(); }
      else setStatus(result === 'cancelled' ? 'Partilha cancelada. A pré-visualização continua disponível.' : 'Guarda a cópia e anexa-a na aplicação de destino.');
    } catch { setStatus('Não foi possível abrir a partilha. Guarda a cópia e anexa-a na aplicação.'); }
    finally { setSharing(false); }
  };
  return <div className="space-y-3">
    {!file && <Button className="w-full" disabled={busy} onClick={() => void prepare()}>Preparar cópia com marca</Button>}
    {busy && <Button variant="outline" className="w-full" onClick={cancel}>Cancelar exportação</Button>}
    {file && preview && <>
      <h4 className="font-medium">Pré-visualização da cópia</h4>
      {files.length > 1 && <label className="block text-sm">Cartão a enviar<select aria-label="Cartão a enviar" value={page} onChange={event => setPage(Number(event.target.value))} className="ml-2 rounded border bg-background p-2">{files.map((_, i) => <option key={i} value={i}>{i + 1} de {files.length}</option>)}</select></label>}
      {file.type.startsWith('video/') ? <video key={preview} src={preview} controls playsInline preload="metadata" className="max-h-[50svh] w-full rounded-lg bg-black" aria-label="Pré-visualização do vídeo exportado" /> : <img src={preview} alt="Cópia com o logótipo Yamilook e identificação do autor" className="max-h-[50svh] w-full rounded-lg object-contain" />}
      <p className="text-xs text-muted-foreground">{file.type.startsWith('video/') ? 'Reproduz para confirmar também o áudio. ' : ''}{file.name} · {(file.size / 1048576).toFixed(1)} MB</p>
      {canShareVideo(file) && <Button className="w-full" disabled={sharing} onClick={() => setChoosing(true)}>Confirmar e escolher aplicação</Button>}
      {choosing && canShareVideo(file) && <FileApplicationPicker disabled={sharing} onShare={() => void share()} />}
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
    <ExportAction key={`${id}:${selected.index}:${mediaUrls[selected.index] ?? ''}`} id={id} index={selected.index} kind={selected.kind} onShared={onShared} />
  </section>;
}
