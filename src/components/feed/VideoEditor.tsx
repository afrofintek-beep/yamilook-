import { useState, useRef, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Scissors, Sparkles, Type, Music, Check, Play, Pause,
  RotateCcw, ChevronLeft, Plus, Minus, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, Volume2, VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EDITOR_TRACKS, createInstrumental, VideoEditorAudio } from '@/lib/video-editor-audio';

/* ─── Types ─── */
interface VideoFilter {
  id: string;
  name: string;
  css: string;
  preview: string; // short label
}

interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
  fontSize: number;
  color: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  align: 'left' | 'center' | 'right';
}

interface VideoEditorProps {
  file: File;
  onSave: (editedFile: File) => void;
  onCancel: () => void;
}

/* ─── Filters ─── */
const FILTERS: VideoFilter[] = [
  { id: 'none', name: 'Original', css: 'none', preview: 'OG' },
  { id: 'warm', name: 'Calor', css: 'sepia(0.3) saturate(1.4) brightness(1.05)', preview: '🌅' },
  { id: 'cool', name: 'Frio', css: 'saturate(0.8) hue-rotate(15deg) brightness(1.05)', preview: '❄️' },
  { id: 'vivid', name: 'Vívido', css: 'saturate(1.8) contrast(1.1)', preview: '🔥' },
  { id: 'bw', name: 'P&B', css: 'grayscale(1) contrast(1.1)', preview: '⚫' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.5) contrast(0.9) brightness(1.1)', preview: '📷' },
  { id: 'dramatic', name: 'Drama', css: 'contrast(1.4) brightness(0.9) saturate(1.2)', preview: '🎭' },
  { id: 'golden', name: 'Gold', css: 'sepia(0.2) saturate(1.6) brightness(1.1) hue-rotate(-10deg)', preview: '👑' },
  { id: 'fade', name: 'Fade', css: 'contrast(0.85) brightness(1.15) saturate(0.7)', preview: '🌫️' },
  { id: 'neon', name: 'Neon', css: 'saturate(2) brightness(1.1) contrast(1.2) hue-rotate(10deg)', preview: '💜' },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#D4AF37', '#FF3B30', '#FF9500',
  '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#FF2D55',
];

/* ─── Tabs ─── */
type EditorTab = 'trim' | 'filters' | 'text' | 'music';

const TABS: { id: EditorTab; icon: typeof Scissors; label: string }[] = [
  { id: 'trim', icon: Scissors, label: 'Cortar' },
  { id: 'filters', icon: Sparkles, label: 'Filtros' },
  { id: 'text', icon: Type, label: 'Texto' },
  { id: 'music', icon: Music, label: 'Música' },
];

const MUSIC_TRACKS = [
  { id: 'none', name: 'Sem música', artist: '', duration: 0 },
  ...EDITOR_TRACKS.map(track => ({ ...track, artist: 'Instrumental Yamilook', duration: 16 * 60 / track.bpm })),
];

export function VideoEditor({ file, onSave, onCancel }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('trim');

  // Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);

  // Filters
  const [activeFilter, setActiveFilter] = useState('none');

  // Text overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [newText, setNewText] = useState('');

  // Music
  const [selectedTrack, setSelectedTrack] = useState('none');
  const [musicVolume, setMusicVolume] = useState(80);
  const [originalVolume, setOriginalVolume] = useState(100);
  const [uploadedMusic, setUploadedMusic] = useState('');
  const [musicLoading, setMusicLoading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const musicInputRef = useRef<HTMLInputElement>(null);
  const musicRequestRef = useRef(0);
  const mixerRef = useRef<VideoEditorAudio | null>(null);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [exportError, setExportError] = useState('');
  const exportingRef = useRef(false);
  const getMixer = () => {
    if (!videoRef.current) throw new Error('Vídeo indisponível');
    const mixer = mixerRef.current ??= new VideoEditorAudio(videoRef.current);
    mixer.setVolumes(originalVolume, musicVolume);
    return mixer;
  };
  useEffect(() => () => {
    musicRequestRef.current++;
    mixerRef.current?.dispose();
    mixerRef.current = null;
  }, []);
  useEffect(() => { mixerRef.current?.setVolumes(originalVolume, musicVolume); }, [originalVolume, musicVolume]);
  useEffect(() => { mixerRef.current?.setTrimStart(trimStart / 100 * duration); }, [trimStart, duration]);

  const selectMusic = (id: string) => {
    musicRequestRef.current++;
    setMusicLoading(false);
    setAudioError('');
    try {
      if (id === 'none') {
        mixerRef.current?.setMusic(null);
      } else {
        const mixer = getMixer();
        void mixer.resume().catch(() => setAudioError('Toca em reproduzir para ativar o som.'));
        mixer.setTrimStart(trimStart / 100 * duration);
        mixer.setMusic(createInstrumental(mixer.context, id));
      }
      setSelectedTrack(id);
      setUploadedMusic('');
    } catch {
      setAudioError('Não foi possível preparar a música neste navegador. Tenta novamente.');
    }
  };

  const uploadMusic = async (audioFile?: File) => {
    if (!audioFile) return;
    const request = ++musicRequestRef.current;
    if (audioFile.size > 30 * 1024 * 1024) {
      setMusicLoading(false);
      setAudioError('Escolhe um ficheiro de áudio até 30 MB.');
      return;
    }
    setAudioError(''); setMusicLoading(true);
    try {
      const mixer = getMixer();
      await mixer.resume();
      const buffer = await mixer.context.decodeAudioData(await audioFile.arrayBuffer());
      if (request !== musicRequestRef.current) return;
      mixer.setTrimStart(trimStart / 100 * duration);
      mixer.setMusic(buffer);
      setSelectedTrack('uploaded'); setUploadedMusic(audioFile.name);
    } catch {
      if (request === musicRequestRef.current) setAudioError('Não foi possível abrir este áudio. Experimenta um ficheiro MP3, M4A ou WAV.');
    } finally {
      if (request === musicRequestRef.current) setMusicLoading(false);
    }
  };

  // Create video URL
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Video metadata
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      setDuration(v.duration);
      setTrimEnd(100);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [videoUrl]);

  // Time update
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      if (exportingRef.current) return;
      const endSec = (trimEnd / 100) * duration;
      if (v.currentTime >= endSec) {
        v.pause();
        v.currentTime = (trimStart / 100) * duration;
        setIsPlaying(false);
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [duration, trimStart, trimEnd]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || exportingRef.current) return;
    if (!v.paused) { v.pause(); setIsPlaying(false); return; }
    setAudioError('');
    try {
      const mixer = getMixer();
      if (v.currentTime < trimStart / 100 * duration || v.currentTime >= trimEnd / 100 * duration) {
        v.currentTime = trimStart / 100 * duration;
      }
      // Both calls start in the tap handler to unlock audio/video on Safari.
      const resumed = mixer.resume();
      const played = v.play();
      void Promise.all([resumed, played]).then(() => setIsPlaying(!v.paused)).catch(() => {
        v.pause(); setIsPlaying(false);
        setAudioError('Não foi possível reproduzir. Toca novamente em reproduzir.');
      });
    } catch { setAudioError('O som não está disponível neste navegador.'); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const filterCSS = FILTERS.find(f => f.id === activeFilter)?.css || 'none';

  // ─── Text overlay management ───
  const addTextOverlay = () => {
    if (!newText.trim()) return;
    const overlay: TextOverlay = {
      id: Date.now().toString(),
      text: newText.trim(),
      x: 50, y: 50,
      fontSize: 24,
      color: '#FFFFFF',
      fontWeight: 'bold',
      fontStyle: 'normal',
      align: 'center',
    };
    setTextOverlays(prev => [...prev, overlay]);
    setNewText('');
    setEditingTextId(overlay.id);
  };

  const updateOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
    if (editingTextId === id) setEditingTextId(null);
  };

  // ─── Export via Canvas + MediaRecorder ───
  const handleSave = async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || exportingRef.current) return;

    exportingRef.current = true;
    setIsProcessing(true);
    setExportError('');
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let frameId = 0;
    let recordingAudio: ReturnType<VideoEditorAudio['record']> | undefined;
    setProcessProgress(0);

    try {
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video not ready');
      const startSec = (trimStart / 100) * duration;
      const endSec = (trimEnd / 100) * duration;
      const totalDuration = endSec - startSec;

      canvas.width = v.videoWidth || 720;
      canvas.height = v.videoHeight || 1280;
      const ctx = canvas.getContext('2d')!;

      // Set up MediaRecorder
      stream = canvas.captureStream(30);

      // A failure must be visible; never silently save a video without its selected audio.
      if (originalVolume > 0 || selectedTrack !== 'none') {
        const mixer = getMixer();
        await mixer.resume();
        recordingAudio = mixer.record();
        recordingAudio.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
      }

      const chunks: Blob[] = [];
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
        .find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const activeRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const exportDone = new Promise<Blob>((resolve, reject) => {
        activeRecorder.onerror = () => reject(new Error('Recording failed'));
        activeRecorder.onstop = () => {
          const type = activeRecorder.mimeType || chunks[0]?.type;
          const blob = new Blob(chunks, { type });
          if (blob.size) resolve(blob);
          else reject(new Error('Empty recording'));
        };
      });

      // Start recording
      v.pause();
      if (Math.abs(v.currentTime - startSec) > 0.001) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            v.removeEventListener('seeked', onSeeked);
            reject(new Error('Video seek timed out'));
          }, 10000);
          const onSeeked = () => { window.clearTimeout(timeout); resolve(); };
          v.addEventListener('seeked', onSeeked, { once: true });
          v.currentTime = startSec;
        });
      }
      if (mixerRef.current) v.volume = 1;

      recorder.start(100);
      await v.play();

      // Render loop
      const renderFrame = () => {
        if (v.currentTime >= endSec || v.paused) {
          if (activeRecorder.state !== 'inactive') activeRecorder.stop();
          v.pause();
          return;
        }

        // Apply filter via canvas
        ctx.filter = filterCSS;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';

        // Draw text overlays
        textOverlays.forEach(overlay => {
          const x = (overlay.x / 100) * canvas.width;
          const y = (overlay.y / 100) * canvas.height;
          const scaledFontSize = (overlay.fontSize / 24) * (canvas.width / 10);

          ctx.font = `${overlay.fontStyle} ${overlay.fontWeight} ${scaledFontSize}px sans-serif`;
          ctx.textAlign = overlay.align;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillText(overlay.text, x + 2, y + 2);
          ctx.fillStyle = overlay.color;
          ctx.fillText(overlay.text, x, y);
        });

        // Update progress
        const elapsed = v.currentTime - startSec;
        setProcessProgress(Math.min(95, (elapsed / totalDuration) * 100));

        frameId = requestAnimationFrame(renderFrame);
      };
      frameId = requestAnimationFrame(renderFrame);

      const blob = await exportDone;
      setProcessProgress(100);

      const editedFile = new File([blob], file.name.replace(/\.\w+$/, '') + (blob.type.includes('mp4') ? '.mp4' : '.webm'), {
        type: blob.type,
      });

      onSave(editedFile);
    } catch (err) {
      console.error('Video export error:', err);
      setExportError('Não foi possível guardar o vídeo com as alterações. O texto foi mantido no editor. Tenta novamente.');
    } finally {
      cancelAnimationFrame(frameId);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach(track => track.stop());
      recordingAudio?.disconnect();
      v.pause();
      exportingRef.current = false;
      setIsPlaying(false);
      setIsProcessing(false);
    }
  };

  const editingOverlay = textOverlays.find(o => o.id === editingTextId);
  const trimStartSec = (trimStart / 100) * duration;
  const trimEndSec = (trimEnd / 100) * duration;
  const trimDuration = trimEndSec - trimStartSec;

  // A nested modal owns focus while editing; a plain body portal leaves the
  // publication sheet's focus trap active and prevents typing on mobile.
  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open && !isProcessing) onCancel(); }}>
    <DialogPrimitive.Portal>
    <DialogPrimitive.Content
      aria-describedby={undefined}
      onInteractOutside={event => event.preventDefault()}
      className="fixed inset-0 z-[200] bg-[#0a0a0a] flex flex-col safe-top safe-bottom pointer-events-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onCancel} disabled={isProcessing} aria-label="Voltar à publicação" className="text-white">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <DialogPrimitive.Title className="text-white font-semibold text-sm">Editar Vídeo</DialogPrimitive.Title>
        <Button
          size="sm"
          className="bg-[#D4AF37] text-black font-semibold rounded-full px-5 hover:bg-[#c9a432]"
          onClick={handleSave}
          disabled={isProcessing || musicLoading}
        >
          {isProcessing ? `${Math.round(processProgress)}%` : 'Guardar'}
        </Button>
      </div>

      {audioError && <p role="alert" className="px-4 py-2 text-sm text-red-400">{audioError}</p>}
      {exportError && <p role="alert" className="px-4 py-2 text-sm text-red-400">{exportError}</p>}

      {/* Video Preview */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden mx-4 rounded-2xl bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full object-contain"
          style={{ filter: filterCSS }}
          playsInline
          muted={false}
          loop={false}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          preload="auto"
        />

        {/* Text overlays on preview */}
        {textOverlays.map(overlay => (
          <div
            key={overlay.id}
            className={cn(
              "absolute z-10 cursor-pointer select-none pointer-events-auto transition-all duration-100",
              editingTextId === overlay.id && "ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-transparent rounded"
            )}
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${overlay.fontSize}px`,
              color: overlay.color,
              fontWeight: overlay.fontWeight,
              fontStyle: overlay.fontStyle,
              textAlign: overlay.align,
              textShadow: '1px 1px 4px rgba(0,0,0,0.7)',
            }}
            onClick={() => setEditingTextId(overlay.id)}
          >
            {overlay.text}
          </div>
        ))}

        {/* Play/Pause button overlay */}
        <button
          aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
          className="absolute inset-0 flex items-center justify-center"
          onClick={togglePlay}
        >
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
              >
                <Play className="w-7 h-7 text-white ml-1" fill="white" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center gap-4">
            <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#D4AF37] rounded-full"
                animate={{ width: `${processProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-white/80 text-sm">A processar vídeo…</span>
          </div>
        )}
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Timeline / Progress bar */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] text-white/60 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div
              className="absolute h-full bg-[#D4AF37]/60 rounded-full"
              style={{
                left: `${trimStart}%`,
                width: `${trimEnd - trimStart}%`,
              }}
            />
            <div
              className="absolute h-full bg-[#D4AF37] rounded-full"
              style={{
                left: `${trimStart}%`,
                width: `${((currentTime / duration) * 100 - trimStart)}%`,
                maxWidth: `${trimEnd - trimStart}%`,
              }}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Editor Panel */}
      <div className="bg-[#111111] rounded-t-2xl border-t border-white/5">
        {/* Tab bar */}
        <div className="flex border-b border-white/5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-[11px] transition-colors",
                activeTab === tab.id
                  ? "text-[#D4AF37]"
                  : "text-white/40"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 min-h-[160px] max-h-[200px] overflow-y-auto">
          {/* TRIM */}
          {activeTab === 'trim' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-white/60 text-xs">
                <span>Início: {formatTime(trimStartSec)}</span>
                <span className="text-[#D4AF37] font-medium">
                  Duração: {formatTime(trimDuration)}
                </span>
                <span>Fim: {formatTime(trimEndSec)}</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-white/40">Início</label>
                  <Slider
                    value={[trimStart]}
                    onValueChange={([v]) => {
                      setTrimStart(Math.min(v, trimEnd - 5));
                      if (videoRef.current) videoRef.current.currentTime = (v / 100) * duration;
                    }}
                    max={100}
                    step={0.5}
                    className="[&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0 [&_.range]:bg-[#D4AF37]/40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-white/40">Fim</label>
                  <Slider
                    value={[trimEnd]}
                    onValueChange={([v]) => {
                      setTrimEnd(Math.max(v, trimStart + 5));
                      if (videoRef.current) videoRef.current.currentTime = (v / 100) * duration;
                    }}
                    max={100}
                    step={0.5}
                    className="[&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0 [&_.range]:bg-[#D4AF37]/40"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/40 text-xs"
                onClick={() => { setTrimStart(0); setTrimEnd(100); }}
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Repor
              </Button>
            </div>
          )}

          {/* FILTERS */}
          {activeTab === 'filters' && (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {FILTERS.map(filter => (
                <button
                  key={filter.id}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-1.5 transition-all",
                    activeFilter === filter.id ? "opacity-100" : "opacity-50"
                  )}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  <div
                    className={cn(
                      "w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors",
                      activeFilter === filter.id ? "border-[#D4AF37]" : "border-transparent"
                    )}
                  >
                    <video
                      src={`${videoUrl}#t=1`}
                      className="w-full h-full object-cover"
                      style={{ filter: filter.css }}
                      muted
                      preload="metadata"
                    />
                  </div>
                  <span className="text-[10px] text-white/70">{filter.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* TEXT */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              {/* Add new text */}
              <div className="flex gap-2">
                <Input
                  aria-label="Texto para o vídeo"
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  placeholder="Escreve aqui…"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTextOverlay(); } }}
                />
                <Button
                  size="icon"
                  className="bg-[#D4AF37] text-black shrink-0"
                  aria-label="Adicionar texto"
                  onClick={addTextOverlay}
                  disabled={!newText.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Editing controls for selected text */}
              {editingOverlay && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 bg-white/5 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/50 truncate max-w-[120px]">
                      "{editingOverlay.text}"
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 h-6 text-xs"
                      onClick={() => removeOverlay(editingOverlay.id)}
                    >
                      <X className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  </div>

                  {/* Font size */}
                  <div className="flex items-center gap-2">
                    <Minus className="w-3 h-3 text-white/40" />
                    <Slider
                      value={[editingOverlay.fontSize]}
                      onValueChange={([v]) => updateOverlay(editingOverlay.id, { fontSize: v })}
                      min={12}
                      max={72}
                      step={1}
                      className="flex-1 [&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0"
                    />
                    <Plus className="w-3 h-3 text-white/40" />
                  </div>

                  {/* Style buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                        editingOverlay.fontWeight === 'bold' ? "bg-[#D4AF37] text-black" : "bg-white/10 text-white/60"
                      )}
                      onClick={() => updateOverlay(editingOverlay.id, {
                        fontWeight: editingOverlay.fontWeight === 'bold' ? 'normal' : 'bold'
                      })}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                        editingOverlay.fontStyle === 'italic' ? "bg-[#D4AF37] text-black" : "bg-white/10 text-white/60"
                      )}
                      onClick={() => updateOverlay(editingOverlay.id, {
                        fontStyle: editingOverlay.fontStyle === 'italic' ? 'normal' : 'italic'
                      })}
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    {(['left', 'center', 'right'] as const).map(a => {
                      const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                      return (
                        <button
                          key={a}
                          className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            editingOverlay.align === a ? "bg-[#D4AF37] text-black" : "bg-white/10 text-white/60"
                          )}
                          onClick={() => updateOverlay(editingOverlay.id, { align: a })}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>

                  {/* Colors */}
                  <div className="flex gap-2">
                    {TEXT_COLORS.map(color => (
                      <button
                        key={color}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-transform",
                          editingOverlay.color === color ? "border-[#D4AF37] scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => updateOverlay(editingOverlay.id, { color })}
                      />
                    ))}
                  </div>

                  {/* Position */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30">Posição vertical</label>
                    <Slider
                      value={[editingOverlay.y]}
                      onValueChange={([v]) => updateOverlay(editingOverlay.id, { y: v })}
                      min={10}
                      max={90}
                      step={1}
                      className="[&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0"
                    />
                  </div>
                </motion.div>
              )}

              {/* List of overlays */}
              {textOverlays.length > 0 && !editingOverlay && (
                <div className="space-y-1">
                  {textOverlays.map(o => (
                    <button
                      key={o.id}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 text-white/70 text-sm"
                      onClick={() => setEditingTextId(o.id)}
                    >
                      <span className="truncate">{o.text}</span>
                      <X
                        className="w-4 h-4 shrink-0 text-white/30"
                        onClick={(e) => { e.stopPropagation(); removeOverlay(o.id); }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MUSIC */}
          {activeTab === 'music' && (
            <div className="space-y-3">
              {/* Volume controls */}
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-white/40 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-[10px] text-white/30">
                    <span>Volume original</span>
                    <span>{originalVolume}%</span>
                  </div>
                  <Slider
                    value={[originalVolume]}
                    onValueChange={([v]) => {
                      setOriginalVolume(v);
                      if (mixerRef.current) mixerRef.current.setVolumes(v, musicVolume);
                      else if (videoRef.current) videoRef.current.volume = v / 100;
                    }}
                    max={100}
                    className="[&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0"
                  />
                </div>
              </div>

              <div className="w-full h-px bg-white/5" />

              <input ref={musicInputRef} type="file" accept="audio/*,.mp3,.m4a,.wav" className="sr-only" aria-label="Carregar música do telefone"
                onChange={event => { void uploadMusic(event.target.files?.[0]); event.target.value = ''; }} />
              <Button variant="outline" className="w-full border-white/20 text-white bg-transparent" disabled={musicLoading || isProcessing} onClick={() => musicInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" />{musicLoading ? 'A preparar áudio…' : 'Adicionar música do telefone'}
              </Button>
              <p className="text-xs text-white/50">Escolhe uma música e toca em reproduzir para ouvir. A música acompanha o corte e repete até ao fim do vídeo.</p>
              {uploadedMusic && <div className="flex items-center gap-2 text-sm text-[#D4AF37]"><Music className="w-4 h-4 shrink-0" /><span className="min-w-0 truncate">{uploadedMusic}</span><Check className="w-4 h-4 shrink-0" /></div>}
              {/* Track list */}
              <div className="space-y-1">
                {MUSIC_TRACKS.map(track => (
                  <button
                    key={track.id}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors",
                      selectedTrack === track.id ? "bg-[#D4AF37]/15" : "bg-transparent"
                    )}
                    disabled={isProcessing}
                    onClick={() => selectMusic(track.id)}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                      selectedTrack === track.id ? "bg-[#D4AF37] text-black" : "bg-white/10 text-white/40"
                    )}>
                      {track.id === 'none' ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        selectedTrack === track.id ? "text-[#D4AF37]" : "text-white/70"
                      )}>
                        {track.name}
                      </p>
                      {track.artist && (
                        <p className="text-[11px] text-white/30 truncate">{track.artist}</p>
                      )}
                    </div>
                    {track.duration > 0 && (
                      <span className="text-[11px] text-white/20 tabular-nums shrink-0">
                        {formatTime(track.duration)}
                      </span>
                    )}
                    {selectedTrack === track.id && (
                      <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Music volume (when track selected) */}
              {selectedTrack !== 'none' && (
                <div className="flex items-center gap-3 pt-1">
                  <Music className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10px] text-white/30">
                      <span>Volume da música</span>
                      <span>{musicVolume}%</span>
                    </div>
                    <Slider
                      value={[musicVolume]}
                      onValueChange={([v]) => setMusicVolume(v)}
                      max={100}
                      className="[&_[role=slider]]:bg-[#D4AF37] [&_[role=slider]]:border-0"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
