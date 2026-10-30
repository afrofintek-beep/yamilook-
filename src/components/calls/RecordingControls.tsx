import { Circle, Pause, Play, Square, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useActiveCallRequired } from './ActiveCallProvider';
import { useRecordingSession } from '@/features/call-recording/useRecordingSession';

interface Participant { id: string; user_id: string; display_name: string }
export function RecordingControls({ callId, participants }: { callId: string; participants: Participant[] }) {
  const { user } = useAuth();
  const { webRTCState } = useActiveCallRequired();
  const recording = useRecordingSession(callId, user?.id, webRTCState.localStream, webRTCState.remoteStreams);
  const { session, busy, error, duration } = recording;
  const initiator = session?.initiated_by === user?.id;
  const pending = session?.status === 'pending_consent' && Date.parse(session.deadline) > Date.now();
  const mine = session?.consents.find(c => c.user_id === user?.id);
  const incoming = !!pending && !initiator && !!mine && !mine.consented && !mine.revoked_at;
  const consented = !!pending && !initiator && mine?.consented;
  const active = session?.status === 'recording' || session?.status === 'paused';
  const elapsed = `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;
  const errorMessage = error && <p role="alert" className="text-sm text-destructive">{error}</p>;
  return <>
    {!recording.hasActiveSession && <div className="absolute top-4 left-4 z-20 max-w-[80%]">
      <Button variant="outline" size="sm" disabled={busy || webRTCState.callStatus !== 'connected'} onClick={recording.request}>
        <Circle className="h-4 w-4 mr-2 text-red-500" />{busy ? 'A preparar…' : 'Gravar'}
      </Button>
      {errorMessage}
      {session?.status === 'completed' && <p role="status">Gravação guardada.</p>}
      {session?.status === 'stopped' && <p role="status">Pedido de gravação terminado.</p>}
    </div>}
    {active && <div role="status" className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-white z-30">
      <Circle className="h-3 w-3 fill-current" />
      <span>{session.status === 'paused' ? 'Gravação em pausa' : 'A gravar'}</span>
      {recording.localRecording && <>
        <span>{elapsed}</span>
        <Button variant="ghost" size="icon" disabled={busy} aria-label={session.status === 'paused' ? 'Retomar gravação' : 'Pausar gravação'} onClick={recording.togglePause}>
          {session.status === 'paused' ? <Play /> : <Pause />}
        </Button>
        <Button variant="ghost" size="icon" disabled={busy} aria-label="Parar e guardar gravação" onClick={recording.stop}><Square /></Button>
      </>}
      {errorMessage}
    </div>}
    {session?.status === 'processing' && <p role="status" className="absolute top-4 left-4 z-20">A guardar gravação…</p>}
    {consented && <p role="status" className="absolute top-4 left-4 z-20">Consentimento guardado. A aguardar os restantes participantes.</p>}
    <Dialog open={!!pending && initiator} onOpenChange={open => { if (!open && !busy) void recording.cancel(); }}>
      <DialogContent onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Autorização para gravar</DialogTitle>
          <DialogDescription>A gravação só começa depois de todos aceitarem. O pedido expira em 60 segundos.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-4">{session?.consents.map(c => <div key={c.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3">
          <span>{participants.find(p => p.user_id === c.user_id)?.display_name || 'Participante'}</span>
          <span className="flex items-center gap-2 text-sm">{c.consented ? <><Check className="h-4 w-4" />Aceitou</> : c.revoked_at ? <><X className="h-4 w-4" />Recusou</> : <><Clock className="h-4 w-4" />A aguardar…</>}</span>
        </div>)}</div>
        {errorMessage}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={recording.cancel}>Cancelar pedido</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={incoming} onOpenChange={open => { if (!open && !busy) void recording.respond(false); }}>
      <DialogContent onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Pedido de gravação</DialogTitle>
          <DialogDescription>Um participante pretende gravar o áudio e o vídeo desta chamada. Autoriza a gravação?</DialogDescription></DialogHeader>
        <p className="text-sm">Pode recusar e continuar na chamada. Fechar este pedido equivale a recusar.</p>
        {errorMessage}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => recording.respond(false)}>Recusar</Button>
          <Button disabled={busy} onClick={() => recording.respond(true)}>Aceitar gravação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
