import { prepareOwnedVideoExport } from '@/lib/owned-video-export';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getOwnedMediaDescriptor, prepareOwnedPostMedia } from '@/lib/owned-post-media';
import { mediaKind } from '../../../shared/owned-post-media.mjs';
import { canShareVideo as canShareFile, sharePreparedVideo as shareFile } from '../../../shared/post-video-sharing.mjs';

function FileActions({ id, index, kind, onShared }: { id: string; index: number; kind: string; onShared?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [download, setDownload] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!file || kind !== 'video') { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);
  useEffect(() => {
    if (!download) return;
    const timeout = window.setTimeout(() => setDownload(null), 30000);
    return () => window.clearTimeout(timeout);
  }, [download]);

  const prepare = async (downloadOnly = false) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => {
      if (request.current !== controller) return;
      controller.abort();
      request.current = null;
      setBusy(false);
      setStatus('A preparação demorou demasiado. Tenta novamente ou descarrega o ficheiro.');
    }, kind === 'video' ? 15 * 60 * 1000 : 120000);
    setBusy(true);
    setDownload(null);
    setStatus(downloadOnly ? 'A preparar descarga…' : 'A preparar ficheiro…');
    try {
      if (kind === 'video') {
        setStatus('A preparar MP4 com áudio. Mantém esta página aberta…');
        const prepared = await prepareOwnedVideoExport(id, index, { signal: controller.signal, onProgress: progress => { if (!controller.signal.aborted) setStatus(`A preparar MP4 com áudio… ${progress}%`); } });
        if (controller.signal.aborted) return;
        setFile(prepared);
        setStatus('MP4 pronto. Reproduz a pré-visualização e escolhe a aplicação ou guarda o vídeo.');
      } else if (downloadOnly) {
        const descriptor = await getOwnedMediaDescriptor(id, index, controller.signal);
        if (controller.signal.aborted) return;
        setDownload(descriptor.downloadUrl);
        setStatus('Toca em Guardar ficheiro. Depois anexa-o na conversa com o teu amigo.');
      } else {
        const prepared = await prepareOwnedPostMedia(id, index, {
          signal: controller.signal,
          onProgress: (loaded, total) => {
            if (!controller.signal.aborted) setStatus(total ? `A preparar ficheiro… ${Math.min(100, Math.round(loaded / total * 100))}%` : `A preparar ficheiro… ${(loaded / 1048576).toFixed(1)} MB`);
          },
        });
        if (controller.signal.aborted) return;
        setFile(prepared);
        setStatus(canShareFile(prepared) ? 'Ficheiro pronto. Escolhe a aplicação e depois o destinatário.' : 'Este navegador não permite enviar ficheiros diretamente. Usa Descarregar ficheiro e anexa-o na aplicação.');
      }
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Não foi possível preparar o ficheiro.');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  };

  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setStatus('Preparação interrompida. Podes tentar novamente.');
  };
  const share = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      // No asynchronous work before the native sheet: preserve iPhone activation.
      const result = await shareFile(file);
      if (result === 'shared') {
        setStatus('Ficheiro entregue à aplicação. Conclui o envio ao destinatário.');
        onShared?.();
      } else setStatus(result === 'cancelled' ? 'Partilha cancelada. O ficheiro continua pronto.' : 'Usa Descarregar ficheiro e anexa-o na aplicação.');
    } catch { setStatus('Não foi possível abrir a partilha. Tenta novamente ou descarrega o ficheiro.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-2">
    {!file && <Button className="w-full" disabled={busy} onClick={() => void prepare()}>Preparar ficheiro</Button>}
    {file && preview && kind === 'video' && <><video src={preview} controls playsInline preload="metadata" aria-label="Pré-visualização do MP4" className="max-h-[50svh] w-full rounded bg-black" /><p className="text-xs">MP4 · {(file.size / 1048576).toFixed(1)} MB · com áudio quando presente no original</p><Button asChild variant="outline" className="w-full"><a href={preview} download={file.name}>Guardar vídeo MP4</a></Button></>}
    {file && canShareFile(file) && <Button className="w-full" disabled={busy} onClick={() => void share()}>Escolher aplicação</Button>}
    {busy && request.current && <Button variant="ghost" className="w-full" onClick={cancel}>Cancelar preparação</Button>}
    {(!file || kind !== 'video') && <Button variant="outline" className="w-full" disabled={busy} onClick={() => void prepare(true)}>Descarregar ficheiro</Button>}
    {download && <Button asChild variant="outline" className="w-full"><a href={download} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Guardar ficheiro</a></Button>}
    <p role="status" aria-live="polite" className="text-sm">{status}</p>
  </div>;
}

export default function OwnedPostMediaShare({ id, mediaUrls, onShared }: { id: string; mediaUrls: string[]; onShared?: () => void }) {
  const media = mediaUrls.flatMap((url, index) => mediaKind(url) ? [{ index, kind: mediaKind(url) }] : []);
  const [selection, setSelection] = useState(media[0]?.index);
  const index = media.some(item => item.index === selection) ? selection : media[0]?.index;
  if (!media.length) return <p className="mb-4 text-sm text-muted-foreground">Esta publicação não tem fotografias ou vídeos disponíveis para enviar como ficheiro.</p>;
  return <section aria-label="Enviar ficheiro a amigos" className="mb-5 space-y-3 border-b pb-4">
    <h3 className="font-semibold">Enviar ficheiro a amigos</h3>
    <p className="text-sm text-muted-foreground">Envia uma cópia da fotografia ou do vídeo. Escolhe o destinatário na aplicação. Quem recebe pode guardar ou reencaminhar o ficheiro.</p>
    {media.length > 1 && <label className="block text-sm">Ficheiro a enviar<select className="mt-1 min-h-11 w-full rounded border bg-background p-2" value={index} onChange={event => setSelection(Number(event.target.value))}>{media.map((item, position) => <option key={item.index} value={item.index}>{item.kind === 'video' ? 'Vídeo' : 'Fotografia'} {position + 1}</option>)}</select></label>}
    <FileActions key={`${id}:${index}:${mediaUrls[index]}`} id={id} index={index} kind={media.find(item => item.index === index)?.kind || 'image'} onShared={onShared} />
  </section>;
}
