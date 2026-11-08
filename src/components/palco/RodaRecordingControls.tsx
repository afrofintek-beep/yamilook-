import { uiText, useUiLocale } from '@/i18n/ui-copy';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle, Pause, Play, Square,
  AlertCircle, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Room } from 'livekit-client';

interface RodaRecordingControlsProps {
  rodaId: string;
  palcoId: string;
  isHost: boolean;
  room: Room | null;
  className?: string;
}

export function RodaRecordingControls({
  rodaId,
  palcoId,
  isHost,
  room,
  className
}: RodaRecordingControlsProps) {
  useUiLocale();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for existing recording on mount
  useEffect(() => {
    if (!rodaId) return;

    const checkExistingRecording = async () => {
      const { data } = await supabase
        .from('roda_recordings')
        .select('*')
        .eq('roda_id', rodaId)
        .in('status', ['recording', 'paused'])
        .maybeSingle();

      if (data) {
        setRecordingId(data.id);
        setIsRecording(data.status === 'recording');
        setIsPaused(data.status === 'paused');

        if (data.started_at) {
          const started = new Date(data.started_at).getTime();
          const elapsed = Math.floor((Date.now() - started) / 1000);
          setRecordingDuration(elapsed);
        }
      }
    };

    checkExistingRecording();
  }, [rodaId]);

  // Recording duration timer
  useEffect(() => {
    if (!isRecording || isPaused) return;

    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get combined stream from LiveKit room
  const getCombinedStream = useCallback((): MediaStream | null => {
    if (!room || !room.localParticipant) return null;

    const tracks: MediaStreamTrack[] = [];

    // Get local video track
    room.localParticipant.videoTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        tracks.push(pub.track.mediaStreamTrack);
      }
    });

    // Get local audio track
    room.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        tracks.push(pub.track.mediaStreamTrack);
      }
    });

    if (tracks.length === 0) return null;

    return new MediaStream(tracks);
  }, [room]);

  // Upload recording to storage
  const uploadRecording = async (blob: Blob, recId: string): Promise<string | null> => {
    try {
      const fileName = `${palcoId}/${rodaId}/${recId}.webm`;

      const { data, error } = await supabase.storage
        .from('roda-recordings')
        .upload(fileName, blob, {
          contentType: 'video/webm',
          upsert: true,
        });

      if (error) throw error;

      return data.path;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!user || !isHost || !room) return;

    try {
      const stream = getCombinedStream();
      if (!stream) {
        toast({
          title: uiText("Erro"),
          description: uiText("Não foi possível capturar o stream. Verifique câmera/microfone."),
          variant: 'destructive',
        });
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);

      const { data: recording, error } = await supabase
        .from('roda_recordings')
        .insert({
          roda_id: rodaId,
          palco_id: palcoId,
          initiated_by: user.id,
          status: 'recording',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('rodas')
        .update({
          recording_enabled: true,
          recording_status: 'recording',
          recording_started_at: new Date().toISOString(),
        })
        .eq('id', rodaId);

      setRecordingId(recording.id);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      setShowConfirmDialog(false);

      toast({
        title: uiText("Gravação iniciada"),
        description: uiText("A sessão está sendo gravada."),
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: uiText("Erro"),
        description: uiText("Falha ao iniciar gravação"),
        variant: 'destructive',
      });
    }
  };

  // Pause/Resume recording
  const togglePause = async () => {
    if (!recordingId || !mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;

    if (isPaused) {
      recorder.resume();
    } else {
      recorder.pause();
    }

    const newStatus = isPaused ? 'recording' : 'paused';

    await supabase
      .from('roda_recordings')
      .update({ status: newStatus })
      .eq('id', recordingId);

    await supabase
      .from('rodas')
      .update({ recording_status: newStatus })
      .eq('id', rodaId);

    setIsPaused(!isPaused);

    toast({
      title: isPaused ? 'Gravação retomada' : 'Gravação pausada',
    });
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recordingId) return;

    setIsUploading(true);

    try {
      const recorder = mediaRecorderRef.current;

      // Stop the MediaRecorder if it's still active
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          try {
            recorder.stop();
          } catch (e) {
            console.warn('[Recording] MediaRecorder.stop() failed, using existing chunks:', e);
            resolve();
          }
        });
      }

      // Build blob from whatever chunks we have
      if (chunksRef.current.length === 0) {
        // Try requesting final data if recorder exists
        console.warn('[Recording] No chunks available');
      }

      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const fileSizeBytes = blob.size;

      console.log('[Recording] Final blob size:', fileSizeBytes, 'chunks:', chunksRef.current.length);

      let storagePath: string | null = null;

      if (fileSizeBytes > 0) {
        storagePath = await uploadRecording(blob, recordingId);
        if (!storagePath) {
          console.error('[Recording] Upload failed, saving metadata without file');
        }
      }

      // Always update the database record, even if upload failed
      const { error: updateError } = await supabase
        .from('roda_recordings')
        .update({
          status: storagePath ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          duration_seconds: recordingDuration,
          storage_path: storagePath,
          file_size_bytes: fileSizeBytes,
        })
        .eq('id', recordingId);

      if (updateError) {
        console.error('[Recording] DB update error:', updateError);
      }

      await supabase
        .from('rodas')
        .update({
          recording_status: storagePath ? 'completed' : 'failed',
          recording_completed_at: new Date().toISOString(),
          recording_duration_seconds: recordingDuration,
        })
        .eq('id', rodaId);

      chunksRef.current = [];
      mediaRecorderRef.current = null;
      streamRef.current = null;

      setIsRecording(false);
      setIsPaused(false);
      setRecordingId(null);
      setRecordingDuration(0);
      setShowStopDialog(false);

      if (storagePath) {
        toast({
          title: uiText("Gravação concluída"),
          description: uiText("A gravação foi salva com sucesso."),
        });
      } else {
        toast({
          title: uiText("Gravação terminada"),
          description: fileSizeBytes > 0
            ? 'A gravação terminou mas houve um erro ao guardar o ficheiro. Tente novamente.'
            : 'Nenhum conteúdo foi capturado.',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('[Recording] Error stopping recording:', error);
      toast({
        title: uiText("Erro"),
        description: uiText("Falha ao parar gravação. Verifique a ligação à internet."),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isHost) return null;

  return (
    <>
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "flex items-center gap-3 bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-full shadow-lg",
              className
            )}
          >
            <motion.div
              animate={isPaused ? {} : { scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Circle className={cn("h-3 w-3", isPaused ? "fill-white/50" : "fill-current")} />
            </motion.div>
            <span className="font-medium">{isPaused ? uiText("PAUSADO") : uiText("REC")}</span>
            <span className="font-mono text-sm">{formatDuration(recordingDuration)}</span>

            <div className="flex items-center gap-1 ml-2 border-l border-white/30 pl-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={togglePause}
                disabled={isUploading}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={() => setShowStopDialog(true)}
                disabled={isUploading}
              >
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isRecording && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "border-white/20 bg-white/10 hover:bg-white/20 text-white gap-2",
            className
          )}
          onClick={() => setShowConfirmDialog(true)}
          disabled={!room}
        >
          <Video className="h-4 w-4" />{uiText("Gravar")}</Button>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-destructive" />{uiText("Iniciar Gravação")}</DialogTitle>
            <DialogDescription>{uiText("Deseja iniciar a gravação desta Roda?")}</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm">{uiText("A gravação capturará o conteúdo da sua transmissão (vídeo e áudio). Você pode pausar ou parar a qualquer momento.")}</p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>{uiText("A gravação será salva no seu painel após finalizada")}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>{uiText("Cancelar")}</Button>
            <Button onClick={startRecording} className="bg-destructive hover:bg-destructive/90">
              <Circle className="h-4 w-4 mr-2 fill-current" />{uiText("Iniciar Gravação")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="h-5 w-5 text-destructive" />{uiText("Parar Gravação")}</DialogTitle>
            <DialogDescription>{uiText("Tem certeza que deseja parar a gravação?")}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-muted flex items-center justify-between">
              <span className="text-sm">{uiText("Duração da gravação:")}</span>
              <span className="font-mono font-medium">{formatDuration(recordingDuration)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowStopDialog(false)} disabled={isUploading}>{uiText("Continuar Gravando")}</Button>
            <Button onClick={stopRecording} variant="destructive" disabled={isUploading}>
              {isUploading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"
                  />{uiText("Salvando...")}</>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />{uiText("Parar e Salvar")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
