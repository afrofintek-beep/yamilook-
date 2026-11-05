import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { downloadRecording, pendingRecordings, RECORDINGS_CHANGED, type PendingRecording } from './pending';
import { saveRecording } from './save';
import { recordingFile, downloadFile } from './export';

type Saved = { id: string; storage_path: string | null; created_at: string; duration_seconds: number | null };
export function Recordings() {
  const { user } = useAuth();
  const ownerId = user?.id;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [pending, setPending] = useState<PendingRecording[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [exportFile, setExportFile] = useState<{ id: string; file: File } | null>(null);
  const [playback, setPlayback] = useState<{ id: string; url: string } | null>(null);
  const reload = useCallback(async () => {
    if (!ownerId) return;
    const [files, result] = await Promise.all([
      pendingRecordings(ownerId),
      supabase.from('call_recordings').select('id,storage_path,created_at,duration_seconds')
        .eq('initiated_by', ownerId).eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
    ]);
    if (currentOwner.current !== ownerId) return;
    const rows = result.data ?? [];
    setPending(files.filter(file => !rows.some(row => row.id === file.id)));
    setSaved(rows);
    if (result.error) setError('Não foi possível carregar as gravações. Tente actualizar.');
  }, [ownerId]);
  useEffect(() => {
    currentOwner.current = ownerId;
    setPending([]); setSaved([]); setPlayback(null); setExportFile(null); setBusy(null); setError('');
    void reload();
    const refresh = () => { void reload(); };
    window.addEventListener(RECORDINGS_CHANGED, refresh);
    window.addEventListener('online', refresh);
    return () => { currentOwner.current = undefined; window.removeEventListener(RECORDINGS_CHANGED, refresh); window.removeEventListener('online', refresh); };
  }, [reload, ownerId]);
  const retry = async (file: PendingRecording) => {
    if (busy || file.ownerId !== ownerId) return;
    setBusy(file.id); setError('');
    try { await saveRecording(file); await reload(); }
    catch (cause) { if (currentOwner.current === ownerId) setError(cause instanceof Error ? cause.message : 'Não foi possível guardar.'); }
    finally { if (currentOwner.current === ownerId) setBusy(null); }
  };
  const play = async (file: Saved) => {
    if (!file.storage_path || busy) return;
    setBusy(file.id); setError('');
    const { data, error } = await supabase.storage.from('call-recordings').createSignedUrl(file.storage_path, 300);
    if (currentOwner.current !== ownerId) return;
    if (error || !data?.signedUrl) setError('Não foi possível abrir esta gravação. Tente novamente.');
    else setPlayback({ id: file.id, url: data.signedUrl });
    setBusy(null);
  };
  const prepareDownload = async (recording: Saved) => {
    if (!ownerId || !recording.storage_path || busy) return;
    setBusy(recording.id); setError(''); setExportFile(null);
    try {
      const { data, error } = await supabase.storage.from('call-recordings').download(recording.storage_path);
      if (currentOwner.current !== ownerId) return;
      if (error || !data?.size) throw new Error('download_failed');
      setExportFile({ id: recording.id, file: recordingFile(data, recording.id, recording.storage_path) });
    } catch {
      if (currentOwner.current === ownerId) setError('Não foi possível descarregar a gravação. Tente novamente.');
    } finally {
      if (currentOwner.current === ownerId) setBusy(null);
    }
  };
  const share = async (file: File) => {
    // A separate tap after fetching preserves Safari's user activation requirement.
    try { await navigator.share({ files: [file] }); }
    catch (cause) {
      if (currentOwner.current === ownerId && !(typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError')) {
        setError('Não foi possível partilhar. Utilize Guardar ficheiro.');
      }
    }
  };
  return <section aria-label="As minhas gravações" className="p-4 space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">As minhas gravações</h2><Button variant="outline" onClick={() => { setError(''); void reload(); }}>Actualizar</Button></div>
    <p className="text-sm text-muted-foreground">Gravações que iniciou, guardadas com o consentimento dos participantes.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {pending.map(file => <div key={file.id} className="rounded-lg border p-3 space-y-2">
      <p>Gravação por enviar · {new Date(file.createdAt).toLocaleString()}</p>
      <p className="text-sm">A cópia está neste dispositivo.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void retry(file)}>{busy === file.id ? 'A guardar…' : 'Tentar guardar novamente'}</Button><Button variant="outline" onClick={() => downloadRecording(file)}>Descarregar gravação</Button></div>
    </div>)}
    {saved.map(file => <div key={file.id} className="rounded-lg border p-3 space-y-2">
      <p>{new Date(file.created_at).toLocaleString()} · {file.duration_seconds ?? 0}s</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy} variant="outline" onClick={() => void play(file)}>Reproduzir gravação</Button>
        <Button disabled={!!busy || !file.storage_path} variant="outline" onClick={() => void prepareDownload(file)}>Descarregar gravação</Button>
      </div>
      {busy === file.id && <p role="status" className="text-sm">A carregar…</p>}
      {exportFile?.id === file.id && <div className="space-y-2">
        <p role="status" className="text-sm">Ficheiro pronto. Escolha como guardar.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadFile(exportFile.file)}>Guardar ficheiro</Button>
          {typeof navigator.canShare === 'function' && navigator.canShare({ files: [exportFile.file] }) &&
            <Button variant="outline" onClick={() => void share(exportFile.file)}>Partilhar / Guardar em Ficheiros</Button>}
        </div>
        <p className="text-sm text-muted-foreground">No iPhone, abra Partilhar e escolha Guardar em Ficheiros, se disponível.</p>
      </div>}
      {playback?.id === file.id && <video className="w-full max-h-80" src={playback.url} controls playsInline onError={() => setError('Não foi possível reproduzir. Toque novamente em Reproduzir gravação.')} />}
    </div>)}
    {!pending.length && !saved.length && !error && <p className="text-sm text-muted-foreground">Ainda não existem gravações guardadas.</p>}
  </section>;
}
