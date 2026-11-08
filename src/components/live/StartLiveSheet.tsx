import { uiText, useUiLocale } from '@/i18n/ui-copy';
/* @refresh reset */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LocalAudioTrack, LocalVideoTrack, type LocalTrack } from 'livekit-client';
import { Radio, Camera, Mic, MicOff, CameraOff, Sparkles } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLiveStreamContext } from '@/components/live/LiveStreamProvider';
import { useToast } from '@/hooks/use-toast';
import { playCountdownBeep, playGoLiveFanfare, playErrorSound } from '@/lib/sounds';

interface StartLiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartLiveSheet({ open, onOpenChange }: StartLiveSheetProps) {
  useUiLocale();
  const navigate = useNavigate();
  const { startStream, loading } = useLiveStreamContext();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const prevCountdownRef = useRef<number | null>(null);
  const pendingTracksRef = useRef<LocalTrack[]>([]);
  const streamInUseRef = useRef(false);

  const [previewRequested, setPreviewRequested] = useState(false);

  // Only request camera when user explicitly taps the preview area
  useEffect(() => {
    if (previewRequested && open) {
      startCameraPreview();
    }
  }, [previewRequested, open]);

  // Clean up when sheet closes
  useEffect(() => {
    if (!open) {
      stopCameraPreview();
      setCountdown(null);
      setIsCountingDown(false);
      setPreviewRequested(false);
    }
    return () => {
      stopCameraPreview();
    };
  }, [open]);

  // Countdown timer logic with sound effects
  useEffect(() => {
    if (countdown === null || !isCountingDown) return;

    // Play sound when countdown changes
    if (countdown > 0 && countdown !== prevCountdownRef.current) {
      playCountdownBeep(countdown);
    } else if (countdown === 0 && prevCountdownRef.current !== 0) {
      playGoLiveFanfare();
    }
    prevCountdownRef.current = countdown;

    if (countdown === 0) {
      // Countdown finished, actually start the stream
      actuallyStartStream();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isCountingDown]);

  const startCameraPreview = async () => {
    try {
      setCameraError(null);

      const videoConstraints: MediaTrackConstraints = {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      let mediaStream: MediaStream;

      try {
        // Request audio only if mic is enabled; if audio permissions are denied,
        // some browsers reject the whole request (including video).
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: micEnabled,
        });
      } catch (err) {
        console.warn('getUserMedia(video+audio) failed; retrying video-only', err);

        // Fallback to video-only so users who deny mic can still go live with camera.
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        setMicEnabled(false);
        // Silently continue without mic
      }

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          // iOS/Safari sometimes needs an explicit play() call.
          videoRef.current
            ?.play()
            .catch((e) => console.warn('Preview video play() blocked', e));
        };
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Sem acesso à câmara. Verifica as permissões.');
      toast({
        title: uiText("Acesso à câmara necessário"),
        description: uiText("Permite o acesso à câmara e microfone para abrir o Palco."),
        variant: 'destructive',
      });
    }
  };

  const stopCameraPreview = () => {
    // If the stream has already been handed off to LiveKit, we must NOT stop tracks here
    // (stopping would kill the live broadcast).
    if (streamInUseRef.current) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const handleGoLive = () => {
    if (!title.trim() || isCountingDown) return;

    if (!stream) {
      if (!previewRequested) {
        setPreviewRequested(true);
        toast({ title: uiText("A ativar câmara..."), description: uiText("Toca em \"Abrir o Palco\" novamente quando estiver pronta.") });
      } else {
        toast({ title: uiText("Câmara não está pronta"), description: uiText("Permite o acesso à câmara primeiro."), variant: 'destructive' });
        startCameraPreview();
      }
      return;
    }

    // IMPORTANT:
    // Don't clone and don't stop the preview stream here.
    // Some browsers stop the underlying camera source when any clone/original is stopped,
    // which results in "no camera" after going live.
    const tracks: LocalTrack[] = [];

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = cameraEnabled;
      tracks.push(new LocalVideoTrack(videoTrack, undefined, true));
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = micEnabled;
      tracks.push(new LocalAudioTrack(audioTrack, undefined, true));
    }

    pendingTracksRef.current = tracks;

    // Start countdown
    setIsCountingDown(true);
    setCountdown(3);
  };

  const actuallyStartStream = async () => {
    const tracksToPublish = pendingTracksRef.current;

    const sessionId = await startStream(title, description, tracksToPublish);
    if (sessionId) {
      // From this point, the camera/mic tracks are owned by the LiveKit room.
      // Do NOT stop them when the sheet closes.
      streamInUseRef.current = true;

      pendingTracksRef.current = [];
      setIsCountingDown(false);
      setCountdown(null);

      // Detach preview video (but keep tracks running for the broadcast)
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);

      onOpenChange(false);
      navigate(`/live/${sessionId}`);
    } else {
      // Cleanup prepared tracks on failure
      tracksToPublish.forEach((t) => t.stop());
      pendingTracksRef.current = [];
      streamInUseRef.current = false;

      // Restart preview if stream failed
      setIsCountingDown(false);
      setCountdown(null);
      stopCameraPreview();
      startCameraPreview();
    }
  };

  const cancelCountdown = () => {
    playErrorSound();
    // Stop any prepared tracks we created from the preview
    pendingTracksRef.current.forEach((t) => t.stop());
    pendingTracksRef.current = [];

    setIsCountingDown(false);
    setCountdown(null);
    prevCountdownRef.current = null;

    // Restore preview
    stopCameraPreview();
    startCameraPreview();
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      // If user closes while counting down, clean up any prepared tracks
      pendingTracksRef.current.forEach((t) => t.stop());
      pendingTracksRef.current = [];

      stopCameraPreview();
      setTitle('');
      setDescription('');
      setCountdown(null);
      setIsCountingDown(false);
    }
    onOpenChange(openState);
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh] rounded-t-3xl">
        <div className="overflow-y-auto max-h-[calc(90vh-2rem)] px-4 pb-8">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="flex items-center justify-center gap-2">
              <Radio className="w-5 h-5 text-destructive" />{uiText("Abrir o Palco")}</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-6">
          {/* Preview area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="aspect-video bg-muted rounded-2xl overflow-hidden relative"
          >
            {stream && !cameraError ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!cameraEnabled ? 'hidden' : ''}`}
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : null}

            {(!stream || cameraError || !cameraEnabled) && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-muted cursor-pointer"
                onClick={() => { if (!previewRequested) setPreviewRequested(true); }}
              >
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    {cameraError ? (
                      <CameraOff className="w-8 h-8 text-destructive" />
                    ) : (
                      <Camera className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {cameraError
                      ? cameraError
                      : !cameraEnabled
                        ? uiText("Câmara desligada")
                        : previewRequested
                          ? uiText("A iniciar câmara...")
                          : uiText("Toca para ativar a câmara")}
                  </p>
                  {cameraError && (
                    <Button size="sm" variant="outline" onClick={startCameraPreview}>{uiText("Tentar novamente")}</Button>
                  )}
                </div>
              </div>
            )}

            {/* Countdown overlay */}
            <AnimatePresence>
              {isCountingDown && countdown !== null && countdown > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center z-20"
                  onClick={cancelCountdown}
                >
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-center"
                  >
                    <span className="text-9xl font-bold text-white drop-shadow-lg">
                      {countdown}
                    </span>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-white/80 text-sm mt-4"
                    >{uiText("Toca para cancelar")}</motion.p>
                  </motion.div>
                </motion.div>
              )}
              {isCountingDown && countdown === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-destructive/80 flex items-center justify-center z-20"
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.8, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    <Radio className="w-16 h-16 text-white mx-auto animate-pulse" />
                    <span className="text-2xl font-bold text-white mt-2 block">{uiText("Estás no Palco!")}</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preview controls */}
            {!isCountingDown && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                <Button
                  size="icon"
                  variant={cameraEnabled ? "secondary" : "destructive"}
                  className="rounded-full"
                  onClick={toggleCamera}
                >
                  {cameraEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                </Button>
                <Button
                  size="icon"
                  variant={micEnabled ? "secondary" : "destructive"}
                  className="rounded-full"
                  onClick={toggleMic}
                >
                  {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="secondary" className="rounded-full">
                  <Sparkles className="w-4 h-4" />
                </Button>
              </div>
            )}
          </motion.div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{uiText("Título *")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={uiText("Sobre o que vais falar hoje?")}
                maxLength={100}
                disabled={isCountingDown}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{uiText("Descrição (opcional)")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={uiText("Conta à banda o que podem esperar...")}
                rows={3}
                maxLength={500}
                disabled={isCountingDown}
              />
            </div>
          </div>

          {/* Abrir o Palco Button */}
          <Button
            className="w-full rounded-full min-h-[48px] py-3 text-base font-semibold bg-destructive hover:bg-destructive/90 text-white"
            onClick={handleGoLive}
            disabled={!title.trim() || loading || isCountingDown}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{uiText("A preparar...")}</>
            ) : isCountingDown ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{uiText("Prepara-te...")}</>
            ) : (
              <>
                <Radio className="w-4 h-4 mr-2" />{uiText("Abrir o Palco")}</>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground pb-4">{uiText("Ao abrir o Palco, aceitas as nossas Regras da Comunidade")}</p>
        </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
