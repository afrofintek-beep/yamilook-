import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Circle, Pause, Play, Square, 
  Download, Trash2, Clock, Users, 
  AlertCircle, Check, X
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
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useActiveCallRequired } from './ActiveCallProvider';
import { useCallRecorder } from '@/hooks/useCallRecorder';

interface Participant {
  id: string;
  user_id: string;
  display_name: string;
}

interface RecordingControlsProps {
  callId: string;
  participants: Participant[];
}

interface ConsentStatus {
  userId: string;
  displayName: string;
  consented: boolean | null;
}

export function RecordingControls({ callId, participants }: RecordingControlsProps) {
  const { user } = useAuth();
  const { webRTCState } = useActiveCallRequired();
  const recorder = useCallRecorder();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showIncomingConsentDialog, setShowIncomingConsentDialog] = useState(false);
  const [pendingRecordingId, setPendingRecordingId] = useState<string | null>(null);
  const [consentStatuses, setConsentStatuses] = useState<ConsentStatus[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waitingForConsent, setWaitingForConsent] = useState(false);
  // Único por instância para não colidir no mesmo tópico do canal realtime.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Listen for recording consent requests
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`recording-consents-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recording_consents',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const consent = payload.new as Tables<'recording_consents'>;
          if (!consent.consented) {
            // We're being asked for consent
            setPendingRecordingId(consent.recording_id);
            setShowIncomingConsentDialog(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Request recording with consent
  const requestRecording = async () => {
    if (!user) return;

    try {
      // Create recording record
      const { data: recording, error } = await supabase
        .from('call_recordings')
        .insert({
          call_id: callId,
          initiated_by: user.id,
          status: 'pending_consent',
        })
        .select()
        .single();

      if (error) throw error;
      setRecordingId(recording.id);

      // Only OTHER participants need to consent. If we're alone, record now.
      const others = participants.filter((p) => p.user_id !== user.id);
      if (others.length === 0) {
        startActualRecording(recording.id);
        return;
      }

      await Promise.all(others.map((p) =>
        supabase.from('recording_consents').insert({
          recording_id: recording.id,
          user_id: p.user_id,
          consented: false,
        }),
      ));

      setConsentStatuses(others.map(p => ({
        userId: p.user_id,
        displayName: p.display_name,
        consented: null,
      })));
      setShowConsentDialog(true);
      setWaitingForConsent(true);
      listenForConsents(recording.id);

    } catch (error) {
      console.error('Error requesting recording:', error);
      toast({
        title: 'Error',
        description: 'Failed to start recording request',
        variant: 'destructive',
      });
    }
  };

  // Listen for consent updates
  const listenForConsents = (recId: string) => {
    const channel = supabase
      .channel(`consents-${recId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recording_consents',
          filter: `recording_id=eq.${recId}`,
        },
        async (payload) => {
          const consent = payload.new as Tables<'recording_consents'>;

          setConsentStatuses(prev => prev.map(c =>
            c.userId === consent.user_id 
              ? { ...c, consented: consent.consented }
              : c
          ));

          // If anyone denies, cancel recording
          if (consent.consented === false && consent.revoked_at) {
            await cancelRecording(recId);
            toast({
              title: 'Recording Cancelled',
              description: 'A participant declined the recording request',
            });
          }

          // Check if all have consented
          const { data: allConsents } = await supabase
            .from('recording_consents')
            .select('*')
            .eq('recording_id', recId);

          if (allConsents?.every(c => c.consented === true)) {
            startActualRecording(recId);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  // Start actual media recording (composite video + mixed audio) after consent.
  const startActualRecording = async (recId: string) => {
    const started = recorder.start(webRTCState.localStream, webRTCState.remoteStreams);
    if (!started) {
      toast({ title: 'Sem vídeo para gravar', description: 'A câmara ainda não está pronta. Tenta quando a chamada ligar.', variant: 'destructive' });
      await supabase.from('call_recordings').update({ status: 'stopped' }).eq('id', recId);
      setRecordingId(null);
      setShowConsentDialog(false);
      setWaitingForConsent(false);
      return;
    }

    await supabase.from('call_recordings').update({ status: 'recording' }).eq('id', recId);

    setIsRecording(true);
    setWaitingForConsent(false);
    setShowConsentDialog(false);
    setRecordingDuration(0);
    toast({ title: 'Gravação iniciada', description: 'A chamada está a ser gravada.' });
  };

  // Cancel recording
  const cancelRecording = async (recId: string) => {
    await supabase
      .from('call_recordings')
      .update({ status: 'stopped' })
      .eq('id', recId);

    setIsRecording(false);
    setWaitingForConsent(false);
    setShowConsentDialog(false);
    setRecordingId(null);
  };

  // Pause/resume recording
  const togglePause = async () => {
    if (!recordingId) return;
    recorder.pause(!isPaused);
    await supabase
      .from('call_recordings')
      .update({ status: isPaused ? 'recording' : 'paused' })
      .eq('id', recordingId);
    setIsPaused(!isPaused);
  };

  // Stop recording: finalise the media, upload the webm, save the file path.
  const stopRecording = async () => {
    if (!recordingId) return;
    const recId = recordingId;
    const dur = recordingDuration;
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);

    toast({ title: 'A guardar gravação…' });
    const blob = await recorder.stop();

    if (!blob) {
      await supabase.from('call_recordings')
        .update({ status: 'stopped', completed_at: new Date().toISOString(), duration_seconds: dur })
        .eq('id', recId);
      setRecordingId(null);
      toast({ title: 'Gravação vazia', variant: 'destructive' });
      return;
    }

    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${callId}/${recId}.${extension}`;
    const { error: upErr } = await supabase.storage
      .from('call-recordings')
      .upload(path, blob, { contentType: blob.type || 'video/webm', upsert: true });

    if (upErr) {
      console.error('[rec] upload failed', upErr);
      await supabase.from('call_recordings')
        .update({ status: 'stopped', duration_seconds: dur })
        .eq('id', recId);
      setRecordingId(null);
      toast({ title: 'Falha ao guardar a gravação', variant: 'destructive' });
      return;
    }

    await supabase.from('call_recordings').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_seconds: dur,
      storage_path: path,
      file_size_bytes: blob.size,
    }).eq('id', recId);

    setRecordingId(null);
    toast({ title: 'Gravação guardada', description: 'A gravação da chamada foi guardada.' });
  };

  // Respond to incoming consent request
  const respondToConsent = async (consent: boolean) => {
    if (!pendingRecordingId || !user) return;

    await supabase
      .from('recording_consents')
      .update({ 
        consented: consent,
        revoked_at: consent ? null : new Date().toISOString(),
      })
      .eq('recording_id', pendingRecordingId)
      .eq('user_id', user.id);

    setShowIncomingConsentDialog(false);
    setPendingRecordingId(null);

    if (!consent) {
      toast({
        title: 'Recording Declined',
        description: 'You declined the recording request.',
      });
    }
  };

  return (
    <>
      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-red-500/90 text-white px-4 py-2 rounded-full z-30"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Circle className="h-3 w-3 fill-current" />
            </motion.div>
            <span className="font-medium">REC</span>
            <span className="font-mono">{formatDuration(recordingDuration)}</span>
            
            <div className="flex items-center gap-1 ml-2 border-l border-white/30 pl-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={togglePause}
              >
                {isPaused ? (
                  <Play className="h-3 w-3" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={stopRecording}
              >
                <Square className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording button */}
      {!isRecording && !waitingForConsent && (
        <Button
          variant="outline"
          size="sm"
          className="absolute top-4 left-4 border-white/20 bg-white/10 hover:bg-white/20 text-white z-20"
          onClick={requestRecording}
        >
          <Circle className="h-4 w-4 mr-2 text-red-500" />
          Record
        </Button>
      )}

      {/* Consent request dialog (initiator) */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recording Consent Required</DialogTitle>
            <DialogDescription>
              Waiting for all participants to consent to recording
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {consentStatuses.map((status) => (
              <div 
                key={status.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-muted"
              >
                <span>{status.displayName}</span>
                {status.consented === null ? (
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 animate-pulse" />
                    Waiting...
                  </span>
                ) : status.consented ? (
                  <span className="text-sm text-green-500 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Consented
                  </span>
                ) : (
                  <span className="text-sm text-red-500 flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Declined
                  </span>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => recordingId && cancelRecording(recordingId)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incoming consent request dialog */}
      <Dialog open={showIncomingConsentDialog} onOpenChange={setShowIncomingConsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Recording Request
            </DialogTitle>
            <DialogDescription>
              A participant wants to record this call. Your consent is required.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm">
                By consenting, you agree to have your audio and video recorded. 
                The recording will be saved and may be shared with other participants.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>This recording requires consent from all participants</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => respondToConsent(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button onClick={() => respondToConsent(true)}>
              <Check className="h-4 w-4 mr-2" />
              I Consent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
