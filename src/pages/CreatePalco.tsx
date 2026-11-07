import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MokubicoInviteSheet, type InvitedUser } from '@/features/mokubico/components/MokubicoInviteSheet';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Globe,
  Lock,
  EyeOff,
  Plus,
  Trash2,
  Mail,
  Mic,
  Star,
  X,
  ImageIcon,
  Loader2,
  Calendar,
  Clock,
  Users,
  Radio,
  Crop,
  MapPin,
  Coins,
  Sparkles
} from 'lucide-react';
import { PalcoIcon } from '@/components/icons/PalcoIcon';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { ImageCropDialog } from '@/components/settings/ImageCropDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreatePalco, useUpdatePalco, usePalco, useCreateRoda } from '@/hooks/usePalco';
import { usePalcoThemes } from '@/hooks/useDiscoverTopics';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrencyRates, CurrencyRate } from '@/hooks/useCurrencyRates';
import { getNearestCountry } from '@/lib/african-locations';
import { getCurrencyForCountry } from '@/lib/country-currency-map';
import { snapToGrid } from '@/lib/geo-privacy';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
const languages = [
  { code: 'PT', get label() { return uiText("Português"); } },
  { code: 'EN', get label() { return uiText("English"); } },
  { code: 'FR', get label() { return uiText("Français"); } },
];

type PalcoVisibility = 'public' | 'private' | 'unlisted';

const visibilityOptions: { value: PalcoVisibility; label: string; icon: typeof Globe; desc: string }[] = [
  { value: 'public', get label() { return uiText("Público"); }, icon: Globe, desc: 'Visível para todos' },
  { value: 'unlisted', get label() { return uiText("Não listado"); }, icon: EyeOff, desc: 'Apenas com link' },
  { value: 'private', get label() { return uiText("Privado"); }, icon: Lock, desc: 'Apenas convidados' },
];

const defaultVoiceTypes = [
  { type: 'email' as const, icon: Mail, label: 'Email', price: 1, delivery: 'Email (24-72h)', enabled: true },
  { type: 'live' as const, icon: Mic, get label() { return uiText("Ao Vivo"); }, price: 3, delivery: 'Ao vivo na Roda', enabled: true },
  { type: 'highlight' as const, icon: Star, get label() { return uiText("Destaque"); }, price: 7, delivery: 'Destaque + resposta aprofundada', enabled: true },
];

const durationOptions = [
  { value: -1, get label() { return uiText("Personalizado (5-60 min)"); } },
  { value: 60, get label() { return uiText("60 min"); } },
  { value: 90, get label() { return uiText("90 min"); } },
  { value: 120, get label() { return uiText("2 horas"); } },
  { value: 150, get label() { return uiText("2h30"); } },
  { value: 180, get label() { return uiText("3 horas"); } },
];

const maxVoicesOptions = [10, 15, 20, 25, 30, 40];

interface RodaDraft {
  id: string;
  datetime: string;
  duration: number;
  maxVoices: number;
  isLive: boolean;
}

export default function CreatePalco() {
  useUiLocale();
  const navigate = useNavigate();
  const { palcoId } = useParams();
  const [searchParams] = useSearchParams();
  // MOKUBICO space this palco is being opened in (e.g. /palco/create?space=sala).
  const mokubicoSpace = searchParams.get('space');
  const isEditMode = !!palcoId;

  const createPalco = useCreatePalco();
  const updatePalco = useUpdatePalco();
  const createRoda = useCreateRoda();
  const { data: existingPalco, isLoading: isLoadingPalco } = usePalco(palcoId);
  const { currencies, selectedCurrency, changeCurrency, loading: currencyLoading } = useCurrencyRates();

  const [step, setStep] = useState(1);
  // MOKUBICO invites — Quarto requires exactly 1; Cozinha guests are optional.
  const needsInvite = mokubicoSpace === 'quarto' || mokubicoSpace === 'cozinha';
  const singleInvite = mokubicoSpace === 'quarto';
  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('PT');
  const [visibility, setVisibility] = useState<PalcoVisibility>('public');
  const [voiceTypes, setVoiceTypes] = useState(defaultVoiceTypes);
  const [allowCustomText, setAllowCustomText] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [rodas, setRodas] = useState<RodaDraft[]>([]);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect currency based on GPS location - only runs once on mount
  const [gpsAttempted, setGpsAttempted] = useState(false);

  useEffect(() => {
    // Skip if already attempted, in edit mode, or currencies not loaded yet
    if (gpsAttempted || isEditMode || currencyLoading) return;

    // Wait for currencies to be loaded
    if (currencies.length === 0) return;

    const detectLocation = async () => {
      if (!navigator.geolocation) {
        console.log('[GPS] Geolocation not supported');
        setGpsAttempted(true);
        return;
      }

      // Only use GPS if permission was already granted — never trigger the popup
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state !== 'granted') {
            console.log('[GPS] Permission not granted, skipping currency detection');
            setGpsAttempted(true);
            return;
          }
        }
      } catch {
        // permissions API not supported — skip to avoid popup
        setGpsAttempted(true);
        return;
      }

      console.log('[GPS] Starting currency detection...');
      setGpsDetecting(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
          const latitude = _cell.lat;
          const longitude = _cell.lng;
          console.log('[GPS] Coordinates obtained:', { latitude, longitude });

          const country = getNearestCountry(latitude, longitude);
          console.log('[GPS] Nearest country:', country);

          if (country) {
            setDetectedCountry(country.country);
            const currencyCode = getCurrencyForCountry(country.countryCode);
            console.log('[GPS] Currency for country:', currencyCode);

            const found = currencies.find(c => c.currency_code === currencyCode);
            if (found) {
              changeCurrency(currencyCode);
              toast.success(`Moeda detetada: ${found.currency_name} (${found.symbol})`);
              console.log('[GPS] Currency set to:', found);
            } else {
              console.log('[GPS] Currency not in list, keeping USD. Available:', currencies.map(c => c.currency_code));
            }
          } else {
            console.log('[GPS] No country found for coordinates');
          }
          setGpsDetecting(false);
          setGpsAttempted(true);
        },
        (error) => {
          console.log('[GPS] Detection failed:', error.code, error.message);
          setGpsDetecting(false);
          setGpsAttempted(true);
        },
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    };

    detectLocation();
  }, [currencies, currencyLoading, isEditMode, changeCurrency, gpsAttempted]);

  // Load existing palco data in edit mode
  useEffect(() => {
    if (existingPalco) {
      setTitle(existingPalco.title);
      setTheme(existingPalco.theme || '');
      setDescription(existingPalco.description || '');
      setLanguage(existingPalco.language);
      setVisibility(existingPalco.visibility);
      setTags(existingPalco.tags || []);
      setAllowCustomText(existingPalco.allow_custom_voice_text);
      if (existingPalco.cover_url) {
        setExistingCoverUrl(existingPalco.cover_url);
        setCoverImage(existingPalco.cover_url);
      }
    }
  }, [existingPalco]);

  const handleCoverClick = () => {
    fileInputRef.current?.click();
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(uiText("A imagem deve ter no máximo 5MB"));
        return;
      }

      // Open crop dialog with the selected image
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImageForCrop(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    // Convert blob to file for upload
    const croppedFile = new File([croppedBlob], 'cover.jpg', { type: 'image/jpeg' });
    setCoverFile(croppedFile);

    // Create preview URL
    const previewUrl = URL.createObjectURL(croppedBlob);
    setCoverImage(previewUrl);
    setTempImageForCrop(null);
  };

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCoverImage(null);
    setCoverFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag) && tags.length < 5) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleUpdateVoicePrice = (type: string, price: number) => {
    setVoiceTypes(voiceTypes.map(vt =>
      vt.type === type ? { ...vt, price } : vt
    ));
  };

  const handleToggleVoiceType = (type: string) => {
    setVoiceTypes(voiceTypes.map(vt =>
      vt.type === type ? { ...vt, enabled: !vt.enabled } : vt
    ));
  };

  const handleAddRoda = () => {
    const newRoda: RodaDraft = {
      id: crypto.randomUUID(),
      datetime: '',
      duration: 90,
      maxVoices: 20,
      isLive: true,
    };
    setRodas([...rodas, newRoda]);
  };

  const handleRemoveRoda = (id: string) => {
    setRodas(rodas.filter(r => r.id !== id));
  };

  const handleUpdateRoda = <K extends keyof RodaDraft>(id: string, field: K, value: RodaDraft[K]) => {
    setRodas(rodas.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const handleSubmit = async () => {
    if (isUploading) return;

    try {
      setIsUploading(true);
      let coverUrl = existingCoverUrl || '';

      // Upload cover image if a new file was selected
      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('palco-covers')
          .upload(fileName, coverFile);

        if (uploadError) {
          toast.error(uiText("Erro ao carregar a imagem de capa"));
          console.error('Upload error:', uploadError);
          setIsUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('palco-covers')
          .getPublicUrl(fileName);

        coverUrl = urlData.publicUrl;
      }

      // Voice prices are entered in local currency — convert to USD for storage
      const rateToUsd = selectedCurrency?.rate_to_usd || 1;
      const enabledVTs = voiceTypes.filter(vt => vt.enabled);
      const pricesInUsd = enabledVTs.map(vt => vt.price * rateToUsd);
      const minPrice = pricesInUsd.length > 0 ? Math.min(...pricesInUsd) : 1;

      if (isEditMode && palcoId) {
        await updatePalco.mutateAsync({
          id: palcoId,
          title,
          theme,
          description,
          language,
          visibility,
          tags,
          allow_custom_voice_text: allowCustomText,
          cover_url: coverUrl || undefined,
        });

        // Update min_price separately since updatePalco doesn't include it
        await supabase
          .from('palcos')
          .update({ min_price: minPrice })
          .eq('id', palcoId);

        // Upsert voice types: delete old ones, insert new enabled ones
        await supabase
          .from('palco_voice_types')
          .delete()
          .eq('palco_id', palcoId);

        if (enabledVTs.length > 0) {
          await supabase
            .from('palco_voice_types')
            .insert(enabledVTs.map((vt, i) => ({
              palco_id: palcoId,
              voice_type: vt.type,
              enabled: true,
              price: pricesInUsd[i],
              currency: 'USD',
              delivery_description: vt.delivery,
            })));
        }

        toast.success(uiText("Palco atualizado com sucesso!"));
        navigate(`/palco/${palcoId}`);
      } else {
        // Create the Palco first
        const newPalco = await createPalco.mutateAsync({
          title,
          theme,
          description,
          language,
          visibility,
          tags,
          allow_custom_voice_text: allowCustomText,
          min_price: minPrice,
          cover_url: coverUrl || undefined,
          space: mokubicoSpace,
        });

        // Insert voice types for the new palco
        if (newPalco?.id) {
          // MOKUBICO invites: who may enter this private space (Quarto/Cozinha).
          if (needsInvite && invited.length > 0) {
            const { error: invErr } = await supabase.from('palco_invites').insert(
              invited.map((u) => ({ palco_id: newPalco.id, invited_user_id: u.id })),
            );
            if (invErr) console.error('Error inviting to palco:', invErr);
          }

          if (enabledVTs.length > 0) {
            await supabase
              .from('palco_voice_types')
              .insert(enabledVTs.map((vt, i) => ({
                palco_id: newPalco.id,
                voice_type: vt.type,
                enabled: true,
                price: pricesInUsd[i],
                currency: 'USD',
                delivery_description: vt.delivery,
              })));
          }

          // Create all the Rodas for this Palco
          const rodasToCreate = rodas.filter(r => r.datetime);

          console.log('Rodas to create:', rodasToCreate);
          console.log('New Palco ID:', newPalco.id);

          if (rodasToCreate.length > 0) {
            for (const roda of rodasToCreate) {
              try {
                console.log('Creating roda:', { palco_id: newPalco.id, scheduled_at: roda.datetime });
                await createRoda.mutateAsync({
                  title: `Roda ${rodasToCreate.indexOf(roda) + 1}`,
                  description: description || 'Sessão ao vivo',
                  scheduled_at: roda.datetime,
                });
                console.log('Roda created successfully');
              } catch (rodaError) {
                console.error('Error creating roda:', rodaError);
                toast.error(uiText("Erro ao criar uma das Rodas"));
              }
            }
          } else {
            console.log('No rodas with datetime found to create');
          }
        }

        toast.success(uiText("Palco criado com sucesso!"));
        navigate('/palco');
      }
    } catch (error) {
      console.error('Error saving palco:', error);
      toast.error(isEditMode ? 'Erro ao atualizar o Palco' : 'Erro ao criar o Palco');
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = createPalco.isPending || updatePalco.isPending || isUploading;

  if (isEditMode && isLoadingPalco) {
    return (
      <div className="min-h-screen bg-palco-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-palco-accent" />
      </div>
    );
  }

  // Validation: Step 2 requires at least one roda WITH a datetime set
  const rodasWithDates = rodas.filter(r => r.datetime && r.datetime.trim() !== '');
  const step1Ok = title.length >= 3 && (!singleInvite || invited.length === 1);
  const canProceed = step === 1 ? step1Ok : step === 2 ? rodasWithDates.length >= 1 : true;

  return (
    <div className="min-h-screen bg-palco-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-palco-bg/95 backdrop-blur-md safe-top">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <Button
              size="icon"
              variant="ghost"
              className="text-palco-text hover:bg-palco-accent/10"
              onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex flex-col items-center">
              <YamilookLogo size="sm" showTagline={false} animate={false} className="opacity-90 scale-75" bgClassName="bg-palco-bg" />
              <div className="flex items-center gap-1 -mt-1">
                <PalcoIcon className="w-4 h-4 text-palco-accent" filled />
                <span className="text-base font-bold text-palco-text tracking-tight">PALCO</span>
              </div>
            </div>
            <div className="w-9" /> {/* Spacer */}
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-palco-text">
                {isEditMode ? uiText("Editar Palco") : uiText("Abrir Banda ao Vivo")}
              </h1>
              <p className="text-xs text-palco-text-secondary">{uiText("Passo ")}{step}{uiText(" de 4")}</p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "w-6 h-1 rounded-full transition-colors",
                    s <= step ? "bg-palco-accent" : "bg-palco-border"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Cover Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleCoverClick}
              className="relative w-full aspect-[16/9] bg-palco-surface rounded-[18px] border-2 border-dashed border-palco-border flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-palco-accent transition-colors"
            >
              {coverImage ? (
                <>
                  <img
                    src={coverImage}
                    alt={uiText("Capa do Palco")}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="p-2 bg-red-500/80 backdrop-blur-sm rounded-full"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-palco-text-secondary mb-2" />
                  <p className="text-sm text-palco-text-secondary">{uiText("Adicionar capa")}</p>
                </>
              )}
            </button>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-palco-text">{uiText("Título do Palco *")}</Label>
              <Input
                placeholder={uiText("Ex: Empreendedorismo em Angola")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-palco-surface border-palco-border"
              />
            </div>

            {/* Theme - Dynamic Categories */}
            <ThemeSelector theme={theme} onThemeChange={setTheme} />

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-palco-text">{uiText("Descrição")}</Label>
              <Textarea
                placeholder={uiText("Descreva o que as pessoas vão aprender...")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-palco-surface border-palco-border resize-none"
                rows={4}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-palco-text">{uiText("Tags (máx. 5)")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={uiText("Adicionar tag")}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className="bg-palco-surface border-palco-border flex-1"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={tags.length >= 5}
                  className="border-palco-border"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-palco-accent/10 text-palco-accent rounded-full text-sm"
                    >
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* MOKUBICO invites (Quarto = 1 person required; Cozinha = optional guests) */}
            {needsInvite && (
              <div className="space-y-2">
                <Label className="text-palco-text">
                  {singleInvite ? uiText("Convidar (Quarto — só nós)") : uiText("Convidar (Cozinha das Sis)")}
                </Label>
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-palco-border bg-palco-surface text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-palco-accent/15 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-palco-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-palco-text">
                      {invited.length === 0
                        ? (singleInvite ? uiText("Escolher a pessoa") : uiText("Adicionar convidadas"))
                        : invited.map((u) => u.name).join(', ')}
                    </div>
                    <div className="text-xs text-palco-text-secondary">
                      {singleInvite ? uiText("Só esta pessoa pode entrar") : uiText("Além das sis, estas pessoas podem entrar")}
                    </div>
                  </div>
                </button>
                {singleInvite && invited.length === 0 && (
                  <p className="text-xs text-destructive">{uiText("Escolhe 1 pessoa para abrir o Quarto.")}</p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Step 2: Rodas */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-palco-text mb-1">{uiText("Rodas")}</h2>
              <p className="text-sm text-palco-text-secondary">{uiText("Cria uma ou várias sessões (Rodas). É obrigatório definir a data e hora de cada uma.")}</p>
            </div>

            {/* Warning if rodas exist but none have dates */}
            {rodas.length > 0 && rodasWithDates.length === 0 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[12px]">
                <p className="text-sm text-destructive">{uiText("⚠️ Por favor, defina a data e hora das Rodas para continuar.")}</p>
              </div>
            )}

            {rodas.length === 0 ? (
              <div className="text-center py-8 bg-palco-surface rounded-[18px] border border-dashed border-palco-border">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-palco-text-secondary" />
                <h3 className="font-medium text-palco-text mb-1">{uiText("Ainda sem Rodas")}</h3>
                <p className="text-sm text-palco-text-secondary mb-4">{uiText("Adiciona a primeira Roda para começar.")}</p>
                <Button
                  onClick={handleAddRoda}
                  className="bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full"
                >
                  <Plus className="w-4 h-4 mr-2" />{uiText("Adicionar Roda")}</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {rodas.map((roda, index) => (
                  <div
                    key={roda.id}
                    className="bg-palco-surface rounded-[18px] border border-palco-border p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-palco-accent/10 flex items-center justify-center">
                          <Radio className="w-4 h-4 text-palco-accent" />
                        </div>
                        <span className="font-medium text-palco-text">{uiText("Roda ")}{index + 1}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRemoveRoda(roda.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Date/Time */}
                    <div className="space-y-2">
                      <Label className="text-palco-text text-sm">{uiText("Data e hora ")}<span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="datetime-local"
                        value={roda.datetime}
                        onChange={(e) => handleUpdateRoda(roda.id, 'datetime', e.target.value)}
                        className={cn(
                          "bg-palco-bg border-palco-border",
                          !roda.datetime && "border-destructive/50"
                        )}
                      />
                      {!roda.datetime && (
                        <p className="text-xs text-destructive">{uiText("Por favor, defina a data e hora da Roda")}</p>
                      )}
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                      <Label className="text-palco-text text-sm">{uiText("Duração")}</Label>
                      <Select
                        value={roda.duration <= 60 && roda.duration > 0 ? '-1' : roda.duration.toString()}
                        onValueChange={(v) => {
                          if (v === '-1') {
                            // Set custom duration - default to 30 min
                            handleUpdateRoda(roda.id, 'duration', 30);
                          } else {
                            handleUpdateRoda(roda.id, 'duration', Number(v));
                          }
                        }}
                      >
                        <SelectTrigger className="bg-palco-bg border-palco-border">
                          <SelectValue>
                            {roda.duration <= 60 && roda.duration > 0
                              ? `Personalizado: ${roda.duration} min`
                              : durationOptions.find(o => o.value === roda.duration)?.label || uiText("60 min")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-palco-surface border-palco-border">
                          {durationOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value.toString()}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Custom duration slider - shows when duration is between 5-60 min */}
                      {roda.duration > 0 && roda.duration <= 60 && (
                        <div className="space-y-3 p-3 bg-palco-bg rounded-[12px]">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-palco-text-secondary">{uiText("Duração personalizada")}</span>
                            <span className="font-semibold text-palco-accent">{roda.duration}{uiText(" min")}</span>
                          </div>
                          <Slider
                            value={[roda.duration]}
                            onValueChange={(values) => handleUpdateRoda(roda.id, 'duration', values[0])}
                            min={5}
                            max={60}
                            step={5}
                            className="[&_[data-radix-slider-track]]:bg-palco-border [&_[data-radix-slider-range]]:bg-palco-accent [&_[data-radix-slider-thumb]]:border-palco-accent [&_[data-radix-slider-thumb]]:bg-palco-surface"
                          />
                          <div className="flex justify-between text-xs text-palco-text-secondary">
                            <span>{uiText("5 min")}</span>
                            <span>{uiText("60 min")}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Max Voices */}
                    <div className="space-y-2">
                      <Label className="text-palco-text text-sm">{uiText("Máx. Vozes")}</Label>
                      <Select
                        value={roda.maxVoices.toString()}
                        onValueChange={(v) => handleUpdateRoda(roda.id, 'maxVoices', Number(v))}
                      >
                        <SelectTrigger className="bg-palco-bg border-palco-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-palco-surface border-palco-border">
                          {maxVoicesOptions.map((opt) => (
                            <SelectItem key={opt} value={opt.toString()}>
                              {opt}{uiText(" vozes")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Is Live Toggle */}
                    <div className="flex items-center justify-between p-3 bg-palco-bg rounded-[12px]">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-palco-accent" />
                        <span className="text-sm text-palco-text">{uiText("Transmissão ao vivo")}</span>
                      </div>
                      <Switch
                        checked={roda.isLive}
                        onCheckedChange={(v) => handleUpdateRoda(roda.id, 'isLive', v)}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full border-palco-border text-palco-text rounded-full"
                  onClick={handleAddRoda}
                >
                  <Plus className="w-4 h-4 mr-2" />{uiText("Adicionar outra Roda")}</Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 3: Settings */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Currency Selection */}
            <div className="space-y-2">
              <Label className="text-palco-text flex items-center gap-2">
                <Coins className="w-4 h-4 text-palco-accent" />{uiText("Moeda de Preços")}</Label>
              <div className="space-y-2">
                <Select
                  value={selectedCurrency?.currency_code || 'USD'}
                  onValueChange={changeCurrency}
                  disabled={currencyLoading}
                >
                  <SelectTrigger className="bg-palco-surface border-palco-border">
                    <SelectValue placeholder={uiText("Selecione a moeda")} />
                  </SelectTrigger>
                  <SelectContent className="bg-palco-surface border-palco-border max-h-60">
                    {currencies.map((curr) => (
                      <SelectItem key={curr.currency_code} value={curr.currency_code}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{curr.symbol}</span>
                          <span>{curr.currency_code}</span>
                          <span className="text-palco-text-secondary">- {curr.country_name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* GPS Detection indicator */}
                {gpsDetecting && (
                  <div className="flex items-center gap-2 text-xs text-palco-text-secondary">
                    <Loader2 className="w-3 h-3 animate-spin" />{uiText("A detetar localização...")}</div>
                )}

                {detectedCountry && !gpsDetecting && (
                  <div className="flex items-center gap-2 text-xs text-palco-accent">
                    <MapPin className="w-3 h-3" />{uiText("Detetado: ")}{detectedCountry}
                  </div>
                )}
              </div>
              <p className="text-xs text-palco-text-secondary">{uiText("Os preços serão apresentados nesta moeda. A conversão é automática com base nas taxas de câmbio.")}</p>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label className="text-palco-text">{uiText("Idioma")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="bg-palco-surface border-palco-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-palco-surface border-palco-border">
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visibility */}
            <div className="space-y-3">
              <Label className="text-palco-text">{uiText("Visibilidade")}</Label>
              {visibilityOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setVisibility(option.value)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-[12px] border transition-all",
                      visibility === option.value
                        ? "bg-palco-accent/10 border-palco-accent"
                        : "bg-palco-surface border-palco-border"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      visibility === option.value
                        ? "bg-palco-accent text-white"
                        : "bg-palco-border text-palco-text-secondary"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className={cn(
                        "font-medium",
                        visibility === option.value ? "text-palco-accent" : "text-palco-text"
                      )}>
                        {option.label}
                      </p>
                      <p className="text-xs text-palco-text-secondary">{option.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Allow Custom Text */}
            <div className="flex items-center justify-between p-4 bg-palco-surface rounded-[12px] border border-palco-border">
              <div>
                <p className="font-medium text-palco-text">{uiText("Permitir texto personalizado")}</p>
                <p className="text-xs text-palco-text-secondary">{uiText("Participantes podem escrever perguntas")}</p>
              </div>
              <Switch
                checked={allowCustomText}
                onCheckedChange={setAllowCustomText}
              />
            </div>
          </motion.div>
        )}

        {/* Step 4: Pricing */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-palco-text mb-2">{uiText("Preços das Vozes")}</h2>
              <p className="text-sm text-palco-text-secondary">{uiText("Defina quanto custa cada tipo de interação")}</p>
              {selectedCurrency && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-palco-accent/10 rounded-full">
                  <Coins className="w-3.5 h-3.5 text-palco-accent" />
                  <span className="text-xs font-medium text-palco-accent">{uiText("Moeda: ")}{selectedCurrency.currency_code} ({selectedCurrency.symbol})
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {voiceTypes.map((vt) => {
                const Icon = vt.icon;
                return (
                  <div
                    key={vt.type}
                    className={cn(
                      "p-4 rounded-[12px] border transition-all",
                      vt.enabled
                        ? "bg-palco-surface border-palco-border"
                        : "bg-palco-bg border-palco-border/50 opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        vt.enabled ? "bg-palco-accent/10 text-palco-accent" : "bg-palco-border text-palco-text-secondary"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-palco-text">{vt.label}</p>
                          <Switch
                            checked={vt.enabled}
                            onCheckedChange={() => handleToggleVoiceType(vt.type)}
                          />
                        </div>
                        <p className="text-xs text-palco-text-secondary mb-3">{vt.delivery}</p>
                        {vt.enabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-palco-accent">
                              {selectedCurrency?.symbol || '$'}
                            </span>
                            <Input
                              type="number"
                              min={1}
                              value={vt.price}
                              onChange={(e) => handleUpdateVoicePrice(vt.type, Number(e.target.value))}
                              className="w-24 bg-palco-bg border-palco-border"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Revenue Split Info */}
            <div className="p-4 bg-palco-accent/5 rounded-[12px] border border-palco-accent/20">
              <p className="text-sm text-palco-text">
                <span className="font-medium">{uiText("Divisão de receita:")}</span>{uiText(" Você recebe 70%, a plataforma retém 30%")}</p>
            </div>

            {/* Currency conversion note */}
            <div className="p-3 bg-palco-bg rounded-[12px] border border-palco-border">
              <p className="text-xs text-palco-text-secondary">{uiText("💡 Os preços são guardados em USD internamente e convertidos automaticamente para a moeda local de cada utilizador.")}</p>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-palco-bg border-t border-palco-border">
        <Button
          className="w-full bg-palco-accent hover:bg-palco-accent/90 text-white rounded-full h-12"
          disabled={!canProceed || isPending}
          onClick={() => {
            if (step < 4) {
              setStep(step + 1);
            } else {
              handleSubmit();
            }
          }}
        >
          {step < 4 ? (
            <>{uiText("Continuar")}<ChevronRight className="w-5 h-5 ml-1" />
            </>
          ) : isPending ? (
            isEditMode ? uiText("A guardar...") : uiText("Criando...")
          ) : (
            isEditMode ? uiText("Guardar Alterações") : uiText("Abrir Banda ao Vivo")
          )}
        </Button>
      </div>

      {/* Image Crop Dialog */}
      {tempImageForCrop && (
        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={(open) => {
            setShowCropDialog(open);
            if (!open) setTempImageForCrop(null);
          }}
          imageSrc={tempImageForCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={16 / 9}
        />
      )}

      {/* MOKUBICO invite picker (Quarto / Cozinha) */}
      {needsInvite && (
        <MokubicoInviteSheet
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          single={singleInvite}
          selected={invited}
          onConfirm={setInvited}
        />
      )}
    </div>
  );
}

// Theme Selector Component with dynamic categories
function ThemeSelector({
  theme,
  onThemeChange
}: {
  theme: string;
  onThemeChange: (theme: string) => void;
}) {
  useUiLocale();
  const { data: themes, isLoading } = usePalcoThemes();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-palco-text">{uiText("Tema")}</Label>
        <div className="h-24 bg-palco-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-palco-text">{uiText("Tema")}</Label>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {themes?.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onThemeChange(t.slug === theme ? '' : t.slug)}
              className={cn(
                "relative flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden transition-all duration-200",
                theme === t.slug
                  ? "ring-2 ring-palco-accent ring-offset-2 ring-offset-palco-bg scale-105"
                  : "opacity-80 hover:opacity-100"
              )}
            >
              {t.image_url ? (
                <img
                  src={t.image_url}
                  alt={t.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-palco-accent/20 to-palco-accent/5 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-palco-accent/50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <p className="text-[10px] font-medium text-white text-center truncate leading-tight">
                  {t.name}
                </p>
              </div>
              {t.is_trending && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-palco-accent rounded-full" />
              )}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
      {theme && (
        <p className="text-xs text-palco-text-secondary">{uiText("Selecionado: ")}<span className="text-palco-accent font-medium">
            {themes?.find(t => t.slug === theme)?.name || theme}
          </span>
        </p>
      )}
    </div>
  );
}
