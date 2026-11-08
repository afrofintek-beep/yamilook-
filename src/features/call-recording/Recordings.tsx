import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { downloadRecording, pendingRecordings, RECORDINGS_CHANGED, type PendingRecording } from './pending';
import { saveRecording } from './save';
import { recordingFile, downloadFile } from './export';

type Saved = { id: string; storage_path: string | null; created_at: string; duration_seconds: number | null; expires_at?: string | null; deletion_requested_at?: string | null };
export function Recordings() {
  useUiLocale();
  const { user } = useAuth();
  const ownerId = user?.id;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const exportTask = useRef<AbortController | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [originalFile, setOriginalFile] = useState<{ id: string; file: File } | null>(null);
  const [exportFile, setExportFile] = useState<{ id: string; file: File } | null>(null);
  const [playback, setPlayback] = useState<{ id: string; url: string } | null>(null);
  const reload = useCallback(async () => {
    if (!ownerId) return;
    const [files, result] = await Promise.all([
      pendingRecordings(ownerId),
      supabase.from('call_recordings').select('id,storage_path,created_at,duration_seconds,expires_at')
        .eq('initiated_by', ownerId).eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
    ]);
    if (currentOwner.current !== ownerId) return;
    const rows = result.data ?? [];
    setPending(files.filter(file => !rows.some(row => row.id === file.id)));
    setSaved(rows);
    if (result.error) setError(uiText("Não foi possível carregar as gravações. Tente actualizar."));
  }, [ownerId]);
  useEffect(() => {
    currentOwner.current = ownerId;
    setPending([]); setSaved([]); setPlayback(null); setExportFile(null); setOriginalFile(null); setExportProgress(null); setBusy(null); setError('');
    void reload();
    const refresh = () => { void reload(); };
    window.addEventListener(RECORDINGS_CHANGED, refresh);
    window.addEventListener('online', refresh);
    return () => { exportTask.current?.abort(); currentOwner.current = undefined; window.removeEventListener(RECORDINGS_CHANGED, refresh); window.removeEventListener('online', refresh); };
  }, [reload, ownerId]);
  const retry = async (file: PendingRecording) => {
    if (busy || file.ownerId !== ownerId) return;
    setBusy(file.id); setError('');
    try { await saveRecording(file); await reload(); }
    catch (cause) { if (currentOwner.current === ownerId) setError(cause instanceof Error ? cause.message : uiText("Não foi possível guardar.")); }
    finally { if (currentOwner.current === ownerId) setBusy(null); }
  };
  const deleteSaved = async (file: Saved) => {
    if (!ownerId || busy || !window.confirm(uiText("Apagar esta gravação definitivamente da aplicação? As cópias descarregadas não serão apagadas."))) return;
    setBusy(file.id); setError('');
    try {
      const { error } = await supabase.functions.invoke('recording-retention', { body: { id: file.id } });
      if (error) throw error;
      if (currentOwner.current !== ownerId) return;
      setPlayback(null); setExportFile(null); setOriginalFile(null);
      await reload();
    } catch {
      if (currentOwner.current === ownerId) setError(uiText("Não foi possível concluir a eliminação. Tente novamente."));
    } finally { if (currentOwner.current === ownerId) setBusy(null); }
  };
  const play = async (file: Saved) => {
    if (!file.storage_path || busy) return;
    setBusy(file.id); setError('');
    const { data, error } = await supabase.storage.from('call-recordings').createSignedUrl(file.storage_path, 300);
    if (currentOwner.current !== ownerId) return;
    if (error || !data?.signedUrl) setError(uiText("Não foi possível abrir esta gravação. Tente novamente."));
    else setPlayback({ id: file.id, url: data.signedUrl });
    setBusy(null);
  };
  const prepareDownload = async (recording: Saved) => {
    if (!ownerId || !recording.storage_path || busy) return;
    setBusy(recording.id); setError(''); setExportFile(null); setOriginalFile(null); setExportProgress(null);
    exportTask.current?.abort();
    const controller = new AbortController(); exportTask.current = controller;
    try {
      const { data, error } = await supabase.storage.from('call-recordings').download(recording.storage_path);
      if (currentOwner.current !== ownerId) return;
      if (error || !data?.size) throw new Error('download_failed');
      const original = recordingFile(data, recording.id, recording.storage_path, recording.created_at);
      setOriginalFile({ id: recording.id, file: original });
      setExportProgress(0);
      const { prepareMp4 } = await import('./mp4');
      const converted = await prepareMp4(original, controller.signal, value => {
        if (currentOwner.current === ownerId && !controller.signal.aborted) setExportProgress(value);
      });
      if (currentOwner.current !== ownerId || controller.signal.aborted) return;
      setExportFile({ id: recording.id, file: converted });
    } catch {
      if (currentOwner.current === ownerId && !controller.signal.aborted) setError(uiText("Não foi possível preparar o formato padrão. Se o original estiver disponível abaixo, pode guardá-lo sem conversão."));
    } finally {
      if (currentOwner.current === ownerId) { setBusy(null); setExportProgress(null); }
    }
  };
  const share = async (file: File) => {
    // A separate tap after fetching preserves Safari's user activation requirement.
    try { await navigator.share({ files: [file] }); }
    catch (cause) {
      if (currentOwner.current === ownerId && !(typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError')) {
        setError(uiText("Não foi possível partilhar. Utilize Guardar ficheiro."));
      }
    }
  };
  return <section aria-label={uiText("As minhas gravações")} className="p-4 space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{uiText("As minhas gravações")}</h2><Button variant="outline" onClick={() => { setError(''); void reload(); }}>{uiText("Actualizar")}</Button></div>
    <p className="text-sm text-muted-foreground">{uiText("Gravações que iniciou com o consentimento de todos os participantes. São conservadas por 30 dias. Descarregue as que pretende manter antes da data indicada.")}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {pending.map(file => <div key={file.id} className="rounded-lg border p-3 space-y-2">
      <p>{uiText("Gravação por enviar · {{value1}}", { value1: (new Date(file.createdAt).toLocaleString(uiLocale())) ?? "" })}</p>
      <p className="text-sm">{uiText("A cópia está neste dispositivo.")}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void retry(file)}>{busy === file.id ? uiText("A guardar…") : uiText("Tentar guardar novamente")}</Button><Button variant="outline" onClick={() => downloadRecording(file)}>{uiText("Descarregar gravação")}</Button></div>
    </div>)}
    {saved.map(file => <div key={file.id} className="rounded-lg border p-3 space-y-2">
      <p>{new Date(file.created_at).toLocaleString(uiLocale())} · {file.duration_seconds ?? 0}s</p>
      {file.expires_at && <p className="text-sm">{uiText("Remoção automática: {{value1}}", { value1: (new Date(file.expires_at).toLocaleString(uiLocale())) ?? "" })}</p>}
      {file.expires_at && Date.parse(file.expires_at) - Date.now() <= 7 * 86400000 && <p role="status" className="text-sm font-semibold">{Date.parse(file.expires_at) <= Date.now() ? uiText("Prazo terminado. A eliminação está pendente.") : Date.parse(file.expires_at) - Date.now() <= 86400000 ? uiText("Esta gravação será apagada em menos de 24 horas. Descarregue-a agora.") : uiText("Esta gravação será apagada nos próximos 7 dias. Descarregue-a para conservar.")}</p>}
      {file.deletion_requested_at && <p role="status">{uiText("Eliminação em curso.")}</p>}
      <Button disabled={!!busy} variant="destructive" onClick={() => void deleteSaved(file)}>{uiText("Apagar gravação")}</Button>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy} variant="outline" onClick={() => void play(file)}>{uiText("Reproduzir gravação")}</Button>
        <Button disabled={!!busy || !file.storage_path} variant="outline" onClick={() => void prepareDownload(file)}>{uiText("Descarregar gravação")}</Button>
      </div>
      {busy === file.id && <p role="status" className="text-sm">{exportProgress === null ? uiText("A carregar…") : uiText("A preparar MP4… {{value1}}%", { value1: (exportProgress) ?? "" })}</p>}
      {originalFile?.id === file.id && !busy && !exportFile && <Button variant="outline" onClick={() => downloadFile(originalFile.file)}>{uiText("Guardar original")}</Button>}
      {exportFile?.id === file.id && <div className="space-y-2">
        <p role="status" className="text-sm">{uiText("Ficheiro pronto. Escolha como guardar.")}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadFile(exportFile.file)}>{uiText("Guardar ficheiro")}</Button>
          {typeof navigator.canShare === 'function' && navigator.canShare({ files: [exportFile.file] }) &&
            <Button variant="outline" onClick={() => void share(exportFile.file)}>{exportFile.file.type.startsWith('video/') ? uiText("Guardar na Fototeca / Partilhar") : uiText("Partilhar / Guardar em Ficheiros")}</Button>}
        </div>
        <p className="text-sm text-muted-foreground">{exportFile.file.type.startsWith('video/') ? uiText("No iPhone, escolha Guardar vídeo na folha de partilha para adicionar à Fototeca. A gravação também permanece na aplicação.") : uiText("No iPhone, abra Partilhar e escolha Guardar em Ficheiros, se disponível.")}</p>
      </div>}
      {playback?.id === file.id && <video className="w-full max-h-80" src={playback.url} controls playsInline onError={() => setError(uiText("Não foi possível reproduzir. Toque novamente em Reproduzir gravação."))} />}
    </div>)}
    {!pending.length && !saved.length && !error && <p className="text-sm text-muted-foreground">{uiText("Ainda não existem gravações guardadas.")}</p>}
  </section>;
}
