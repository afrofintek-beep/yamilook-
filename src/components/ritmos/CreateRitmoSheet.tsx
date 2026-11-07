import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Video,
  Camera,
  Image,
  MapPin,
  Loader2,
  Play,
  Check,
  Navigation,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useRitmos } from '@/hooks/useRitmos';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AFRICAN_LOCATIONS,
  getCountries,
  getNearestCountry
} from '@/lib/african-locations';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { snapToGrid } from '@/lib/geo-privacy';

interface CreateRitmoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_VIDEO_DURATION = 30; // seconds
const MAX_VIDEO_SIZE_MB = 50;
const MAX_CAPTION_LENGTH = 100;

type Step = 'select' | 'preview' | 'details';

export function CreateRitmoSheet({ open, onOpenChange }: CreateRitmoSheetProps) {
  useUiLocale();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { uploadMedia, uploading } = useMediaUpload();
  const { createRitmo } = useRitmos();

  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [caption, setCaption] = useState('');
  const [country, setCountry] = useState<string>('AO'); // Default to Angola
  const [city, setCity] = useState<string>('Luanda');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const resetForm = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setVideoPreview(null);
    setVideoDuration(0);
    setCaption('');
    setCountry('');
    setCity('');
    setNeighborhood('');
    setIsSubmitting(false);
    setCompressionProgress(0);
    setLocationDetected(false);
    setLocationError(null);
  }, []);

  // Get country data
  const selectedCountryData = AFRICAN_LOCATIONS.find(l => l.countryCode === country);
  const cities = selectedCountryData?.cities || [];
  const selectedCityData = cities.find(c => c.name === city);
  const neighborhoods = selectedCityData?.neighborhoods || [];

  // Auto-detect location when video is selected
  const detectLocation = useCallback(async () => {
    setDetectingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Este dispositivo não permite gerar o endereço AFROLOC automaticamente');
      setDetectingLocation(false);
      return;
    }

    // Only use GPS if permission already granted — avoid popup
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state !== 'granted') {
          setLocationError('Acesso ao endereço AFROLOC não concedido. Ativa nas definições.');
          setDetectingLocation(false);
          return;
        }
      }
    } catch {
      setDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Snap to ~10m grid cell immediately — precise coords must never flow further
        const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
        const latitude = _cell.lat;
        const longitude = _cell.lng;
        const detectedCountry = getNearestCountry(latitude, longitude);

        if (detectedCountry) {
          setCountry(detectedCountry.countryCode);

          // Try to find nearest city based on coordinates
          if (detectedCountry.cities.length > 0) {
            setCity(detectedCountry.cities[0].name);

            // Set first neighborhood if available
            if (detectedCountry.cities[0].neighborhoods?.length) {
              setNeighborhood(detectedCountry.cities[0].neighborhoods[0]);
            }
          }
          setLocationDetected(true);
        } else {
          setLocationError('Não foi possível gerar o teu endereço AFROLOC');
        }
        setDetectingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Acesso ao endereço AFROLOC negado. Ativa nas definições.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Tempo esgotado ao gerar o endereço AFROLOC. Tenta novamente.');
        } else {
          setLocationError('Erro ao gerar o endereço AFROLOC. Tenta novamente.');
        }
        setDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Auto-detect location when moving to details step
  useEffect(() => {
    if (step === 'details' && !locationDetected && !detectingLocation) {
      detectLocation();
    }
  }, [step, locationDetected, detectingLocation, detectLocation]);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const validateVideo = useCallback(async (file: File): Promise<boolean> => {
    // Check file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_VIDEO_SIZE_MB) {
      toast.error(`Video too large. Maximum ${MAX_VIDEO_SIZE_MB}MB allowed.`);
      return false;
    }

    // Check if it's a video
    if (!file.type.startsWith('video/')) {
      toast.error(uiText("Please select a video file."));
      return false;
    }

    // Check duration
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_VIDEO_DURATION) {
          toast.error(`Video too long. Maximum ${MAX_VIDEO_DURATION} seconds allowed.`);
          resolve(false);
        } else if (video.duration < 3) {
          toast.error(uiText("Video too short. Minimum 3 seconds required."));
          resolve(false);
        } else {
          setVideoDuration(Math.round(video.duration));
          resolve(true);
        }
      };

      video.onerror = () => {
        toast.error(uiText("Invalid video file."));
        resolve(false);
      };

      video.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isValid = await validateVideo(file);
    if (!isValid) {
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setStep('preview');
  }, [validateVideo]);

  const handleSubmit = async () => {
    if (!selectedFile || !user) {
      toast.error(uiText("Por favor, selecione um vídeo"));
      return;
    }

    // Validate location before saving
    if (!city) {
      toast.error(uiText("Endereço AFROLOC obrigatório. Por favor, seleciona uma cidade."));
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload video
      toast.loading('A publicar Ritmo...', { id: 'upload-ritmo' });

      const result = await uploadMedia(selectedFile, 'video');

      if (!result) {
        throw new Error(uiText("Failed to upload video"));
      }

      // Create ritmo record
      await createRitmo(result.url, caption.trim() || undefined, {
        city,
        neighborhood: neighborhood || undefined,
      });

      toast.success(uiText("Ritmo publicado! 🪘"), { id: 'upload-ritmo' });
      handleClose();
    } catch (error) {
      console.error('Error creating ritmo:', error);
      toast.error(uiText("Falha ao publicar Ritmo"), { id: 'upload-ritmo' });
    } finally {
      setIsSubmitting(false);
    }
  };



  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              <SheetHeader className="p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2">
                    <span className="text-xl">🪘</span>{uiText("Criar Ritmo")}</SheetTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </SheetHeader>

              <div className="flex-1 flex flex-col items-center justify-center relative px-6">
                {/* Tagline */}
                <p className="text-muted-foreground text-center mb-12 text-sm">{uiText("Partilha um momento com a tua banda")}</p>

                {/* TikTok-style layout: Central record button + gallery in corner */}
                <div className="relative flex flex-col items-center">
                  {/* Main Record Button - Large circular */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => cameraInputRef.current?.click()}
                    className="relative w-24 h-24 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/30"
                  >
                    <div className="w-20 h-20 rounded-full bg-destructive border-4 border-background flex items-center justify-center">
                      <Camera className="w-8 h-8 text-destructive-foreground" />
                    </div>
                  </motion.button>

                  <span className="mt-3 text-sm font-medium">{uiText("Gravar")}</span>
                </div>

                {/* Gallery button - positioned to the right */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => galleryInputRef.current?.click()}
                  className="absolute right-8 bottom-1/3 flex flex-col items-center gap-2"
                >
                  <div className="w-14 h-14 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden">
                    <Image className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">{uiText("Galeria")}</span>
                </motion.button>

                {/* Duration hint */}
                <p className="absolute bottom-8 text-xs text-muted-foreground text-center">{uiText("Vídeos de 3-")}{MAX_VIDEO_DURATION}{uiText(" segundos")}</p>

                {/* Hidden inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col h-full"
            >
              {/* Video preview */}
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoPreview || ''}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />

                {/* Back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 left-4 text-white hover:bg-white/20 z-10"
                  onClick={() => setStep('select')}
                >
                  <X className="w-5 h-5" />
                </Button>

                {/* Duration badge */}
                <div className="absolute bottom-4 left-4 bg-black/60 text-white px-2 py-1 rounded text-sm">
                  {videoDuration}s
                </div>
              </div>

              {/* Continue button */}
              <div className="p-4 border-t bg-background flex-shrink-0">
                <Button
                  className="w-full rounded-xl"
                  onClick={() => setStep('details')}
                >{uiText("Continue")}</Button>
              </div>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col h-full"
            >
              <SheetHeader className="p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('preview')}
                  >{uiText("Back")}</Button>
                  <SheetTitle>{uiText("Add Details")}</SheetTitle>
                  <div className="w-12" /> {/* Spacer */}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-auto p-4 space-y-6">
                {/* Video thumbnail */}
                <div className="relative aspect-[9/16] max-h-48 w-auto mx-auto rounded-xl overflow-hidden bg-black">
                  <video
                    src={videoPreview || ''}
                    className="h-full w-full object-cover"
                    muted
                  />
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
                    {videoDuration}s
                  </div>
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <Label htmlFor="caption" className="flex items-center justify-between">
                    <span>{uiText("Caption")}</span>
                    <span className="text-xs text-muted-foreground">
                      {caption.length}/{MAX_CAPTION_LENGTH}
                    </span>
                  </Label>
                  <Textarea
                    id="caption"
                    placeholder={uiText("What's happening? 🪘")}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
                    className="resize-none rounded-xl"
                    rows={2}
                  />
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />{uiText("Identidade territorial *")}{detectingLocation && (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={detectLocation}
                      disabled={detectingLocation}
                      className="text-xs gap-1"
                    >
                      <Navigation className="w-3 h-3" />{uiText("Detectar")}</Button>
                  </div>

                  {locationError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {locationError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {locationDetected && !locationError && (
                    <Alert className="py-2 border-primary/30 bg-primary/5">
                      <Check className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-xs text-primary">{uiText("Endereço AFROLOC detetado automaticamente")}</AlertDescription>
                    </Alert>
                  )}

                  {/* Country selector */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{uiText("País")}</Label>
                    <Select value={country || "none"} onValueChange={(val) => {
                      const newCountry = val === "none" ? "" : val;
                      setCountry(newCountry);
                      if (newCountry) {
                        const countryData = AFRICAN_LOCATIONS.find(l => l.countryCode === newCountry);
                        if (countryData && countryData.cities.length > 0) {
                          setCity(countryData.cities[0].name);
                        } else {
                          setCity('');
                        }
                      } else {
                        setCity('');
                      }
                      setNeighborhood('');
                    }}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={uiText("Selecionar país...")} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-background max-h-60">
                        <SelectItem value="none">{uiText("Selecionar...")}</SelectItem>
                        {getCountries().map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{uiText("Cidade *")}</Label>
                      <Select value={city || "none"} onValueChange={(val) => {
                        setCity(val === "none" ? "" : val);
                        setNeighborhood('');
                      }}>
                        <SelectTrigger className={cn("rounded-xl", !city && "border-destructive")}>
                          <SelectValue placeholder={uiText("Selecionar...")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999] bg-background max-h-60">
                          <SelectItem value="none">{uiText("Selecionar...")}</SelectItem>
                          {cities.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{uiText("Bairro")}</Label>
                      <Select
                        value={neighborhood || "none"}
                        onValueChange={(val) => setNeighborhood(val === "none" ? "" : val)}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={uiText("Selecionar...")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999] bg-background max-h-60">
                          <SelectItem value="none">{uiText("Nenhum")}</SelectItem>
                          {neighborhoods.map((n) => (
                            <SelectItem key={n} value={n}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <div className="p-4 border-t bg-background flex-shrink-0">
                <Button
                  className="w-full rounded-xl gap-2"
                  onClick={handleSubmit}
                  disabled={isSubmitting || uploading || !city}
                >
                  {isSubmitting || uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />{uiText("A publicar...")}</>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />{uiText("Publicar Ritmo")}</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
