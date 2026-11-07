import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, X, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface VoicemailRecorderProps {
  callId?: string;
  toUserId: string;
  toUserName: string;
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export function VoicemailRecorder({
  callId,
  toUserId,
  toUserName,
  isOpen,
  onClose,
  onSent,
}: VoicemailRecorderProps) {
  useUiLocale();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(d => {
          // Max 2 minutes
          if (d >= 120) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: uiText("Erro"),
        description: uiText("Não foi possível aceder ao microfone"),
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  const sendVoicemail = async () => {
    if (!audioBlob || !user) return;

    setIsSending(true);

    try {
      // Upload to storage
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);

      // Save voicemail record
      const { error: insertError } = await supabase
        .from('voicemails')
        .insert({
          call_id: callId || null,
          from_user_id: user.id,
          to_user_id: toUserId,
          audio_url: urlData.publicUrl,
          duration_seconds: duration,
        });

      if (insertError) throw insertError;

      toast({
        title: uiText("Mensagem enviada!"),
        description: `A tua mensagem de voz foi enviada para ${toUserName}`,
      });

      onSent?.();
      onClose();

    } catch (error) {
      console.error('Error sending voicemail:', error);
      toast({
        title: uiText("Erro"),
        description: uiText("Não foi possível enviar a mensagem de voz"),
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{uiText("Deixar mensagem de voz")}</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-muted-foreground text-sm mb-6">
            {toUserName}{uiText(" não atendeu. Deixa uma mensagem de voz.")}</p>

          <div className="flex flex-col items-center gap-4">
            {/* Recording visualization */}
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center transition-all",
              isRecording && !isPaused
                ? "bg-red-500/20 animate-pulse"
                : audioBlob
                  ? "bg-primary/20"
                  : "bg-secondary"
            )}>
              {isRecording ? (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-red-500 rounded-full"
                      animate={{
                        height: isPaused ? 8 : [8, 24, 8],
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: isPaused ? 0 : Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
              ) : audioBlob ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-16 h-16 rounded-full"
                  onClick={playRecording}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8" />
                  )}
                </Button>
              ) : (
                <Mic className="w-12 h-12 text-muted-foreground" />
              )}
            </div>

            {/* Timer */}
            <div className="text-2xl font-mono">
              {formatTime(duration)}
              {duration >= 120 && (
                <span className="text-xs text-muted-foreground ml-2">{uiText("máx.")}</span>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!audioBlob ? (
                <>
                  {isRecording ? (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full"
                        onClick={pauseRecording}
                      >
                        {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                      </Button>
                      <Button
                        size="icon"
                        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600"
                        onClick={stopRecording}
                      >
                        <MicOff className="w-6 h-6" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="icon"
                      className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
                      onClick={startRecording}
                    >
                      <Mic className="w-6 h-6" />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={deleteRecording}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90"
                    onClick={sendVoicemail}
                    disabled={isSending}
                  >
                    <Send className="w-6 h-6" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Hidden audio element for playback */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
