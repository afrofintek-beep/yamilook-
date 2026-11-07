import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, MapPin, Phone, Mail, Globe, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { useAdvertising, BusinessProfile, LocationMarket } from '@/hooks/useAdvertising';
import { useTranslation } from 'react-i18next';
import { snapToGrid } from '@/lib/geo-privacy';

interface BusinessProfileSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (profile: BusinessProfile) => void;
}

const businessCategories = [
  { value: 'restaurant', get label() { return uiText("Restaurante"); } },
  { value: 'retail', get label() { return uiText("Comércio"); } },
  { value: 'services', get label() { return uiText("Serviços"); } },
  { value: 'beauty', get label() { return uiText("Beleza & Estética"); } },
  { value: 'health', get label() { return uiText("Saúde"); } },
  { value: 'education', get label() { return uiText("Educação"); } },
  { value: 'entertainment', get label() { return uiText("Entretenimento"); } },
  { value: 'automotive', get label() { return uiText("Automóvel"); } },
  { value: 'real_estate', get label() { return uiText("Imobiliário"); } },
  { value: 'technology', get label() { return uiText("Tecnologia"); } },
  { value: 'other', get label() { return uiText("Outro"); } },
];

export function BusinessProfileSetup({ open, onOpenChange, onComplete }: BusinessProfileSetupProps) {
  useUiLocale();
  const { t } = useTranslation();
  const { createBusinessProfile, updateBusinessProfile, businessProfile, locationMarkets, loading } = useAdvertising();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<LocationMarket | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Load existing profile data
  useEffect(() => {
    if (businessProfile) {
      setBusinessName(businessProfile.business_name);
      setCategory(businessProfile.business_category || '');
      setDescription(businessProfile.description || '');
      setPhone(businessProfile.phone || '');
      setEmail(businessProfile.email || '');
      setWebsite(businessProfile.website || '');
      setAddress(businessProfile.address || '');
      setLatitude(businessProfile.latitude);
      setLongitude(businessProfile.longitude);

      // Find matching market
      const market = locationMarkets.find(
        m => m.city === businessProfile.city && m.neighborhood === businessProfile.neighborhood
      );
      if (market) setSelectedMarket(market);
    }
  }, [businessProfile, locationMarkets]);

  // Detect location
  const detectLocation = async () => {
    if (!navigator.geolocation) return;

    // Only use GPS if permission already granted — avoid popup
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state !== 'granted') return;
      }
    } catch { return; }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
        setLatitude(_cell.lat);
        setLongitude(_cell.lng);

        // Find nearest market
        let nearestMarket: LocationMarket | null = null;
        let minDistance = Infinity;

        locationMarkets.forEach(market => {
          const distance = Math.sqrt(
            Math.pow(_cell.lat - market.latitude, 2) +
            Math.pow(_cell.lng - market.longitude, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestMarket = market;
          }
        });

        if (nearestMarket) {
          setSelectedMarket(nearestMarket);
        }
        setDetectingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setDetectingLocation(false);
      }
    );
  };

  // Auto-detect on mount
  useEffect(() => {
    if (open && !selectedMarket && locationMarkets.length > 0) {
      detectLocation();
    }
  }, [open, locationMarkets]);

  const handleSubmit = async () => {
    if (!businessName.trim()) return;

    setIsSubmitting(true);

    const profileData = {
      business_name: businessName,
      business_category: category || null,
      description: description || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      address: address || null,
      city: selectedMarket?.city || null,
      neighborhood: selectedMarket?.neighborhood || null,
      latitude,
      longitude,
    };

    let result;
    if (businessProfile) {
      result = await updateBusinessProfile(profileData);
    } else {
      result = await createBusinessProfile(profileData);
    }

    setIsSubmitting(false);

    if (result) {
      onComplete?.(result);
      onOpenChange(false);
    }
  };

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{uiText("Informações do Negócio")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{uiText("Diga-nos mais sobre o seu negócio")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">{uiText("Nome do negócio *")}</Label>
          <Input
            id="businessName"
            placeholder={uiText("Ex: Café Central")}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{uiText("Categoria")}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder={uiText("Selecione uma categoria")} />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200] max-h-60">
              {businessCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{uiText("Descrição")}</Label>
          <Textarea
            id="description"
            placeholder={uiText("Descreva o seu negócio em poucas palavras...")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <Button
        onClick={() => setStep(2)}
        disabled={!businessName.trim()}
        className="w-full"
      >{uiText("Continuar")}</Button>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{uiText("Localização")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{uiText("Onde está localizado o seu negócio?")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{uiText("Área de atuação")}</Label>
          <Select
            value={selectedMarket?.id || ''}
            onValueChange={(id) => {
              const market = locationMarkets.find(m => m.id === id);
              setSelectedMarket(market || null);
              if (market) {
                setLatitude(market.latitude);
                setLongitude(market.longitude);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={uiText("Selecione a área")} />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200] max-h-60">
              {locationMarkets.map((market) => (
                <SelectItem key={market.id} value={market.id}>
                  {market.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={detectLocation}
            disabled={detectingLocation}
            className="w-full mt-2"
          >
            {detectingLocation ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4 mr-2" />
            )}{uiText("Detetar automaticamente")}</Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">{uiText("Endereço (opcional)")}</Label>
          <Input
            id="address"
            placeholder={uiText("Rua, número, bairro...")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">{uiText("Voltar")}</Button>
        <Button onClick={() => setStep(3)} className="flex-1">{uiText("Continuar")}</Button>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Phone className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">{uiText("Contactos do negócio")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{uiText("Como os clientes podem contactar-te?")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">{uiText("Telefone")}</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              placeholder={uiText("+244 9XX XXX XXX")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="negocio@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">{uiText("Website")}</Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="website"
              placeholder="https://..."
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)} className="flex-1">{uiText("Voltar")}</Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {businessProfile ? uiText("Guardar") : uiText("Criar Perfil")}
            </>
          )}
        </Button>
      </div>

      {!businessProfile && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{uiText("500 créditos grátis!")}</p>
            <p className="text-xs text-muted-foreground">{uiText("Ao criar o perfil, recebes créditos para experimentar a promoção do teu negócio.")}</p>
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {businessProfile ? uiText("Editar Perfil de Negócio") : uiText("Criar Perfil de Negócio")}
          </SheetTitle>
        </SheetHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-4 shrink-0">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="pb-8">
            <AnimatePresence mode="wait">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
