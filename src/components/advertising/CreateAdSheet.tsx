import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Megaphone,
  Image,
  Loader2,
  MapPin,
  TrendingUp,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAdvertising, Advertisement, LocationMarket } from '@/hooks/useAdvertising';
import { usePosts, PostWithUser } from '@/hooks/usePosts';
import { useAuth } from '@/hooks/useAuth';
import { addDays } from 'date-fns';
import { format } from '@/i18n/ui-date';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { snapToGrid } from '@/lib/geo-privacy';

interface CreateAdSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPostId?: string;
}

export function CreateAdSheet({ open, onOpenChange, preselectedPostId }: CreateAdSheetProps) {
  useUiLocale();
  const { user } = useAuth();
  const {
    businessProfile,
    locationMarkets,
    createAdvertisement,
    activateAdvertisement,
    findNearestMarket,
    fetchBusinessProfile
  } = useAdvertising();
  const { getUserPosts } = usePosts();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userPosts, setUserPosts] = useState<PostWithUser[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Form state - simplified (no radius)
  const [adType, setAdType] = useState<'promoted_post' | 'business_profile'>('promoted_post');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(preselectedPostId || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [callToAction, setCallToAction] = useState('Saber mais');
  const [ctaUrl, setCtaUrl] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<LocationMarket | null>(null);
  const [dailyBudget, setDailyBudget] = useState(100);
  const [totalBudget, setTotalBudget] = useState(500);
  const [duration, setDuration] = useState(7);

  // Auto-detect location and refresh balance on open
  useEffect(() => {
    if (open) {
      // Refresh business profile to get latest credit balance
      fetchBusinessProfile();

      // Deep link "Promover" from a post: pre-select it as a promoted post.
      if (preselectedPostId) {
        setAdType('promoted_post');
        setSelectedPostId(preselectedPostId);
      }

      if (!selectedMarket && locationMarkets.length > 0) {
        detectLocation();
      }
    }
  }, [open, preselectedPostId, locationMarkets, fetchBusinessProfile]);

  // Detect user location and find nearest market
  const detectLocation = () => {
    if (!navigator.geolocation) return;

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
        const nearest = findNearestMarket(_cell.lat, _cell.lng);
        if (nearest) {
          setSelectedMarket(nearest);
        }
        setDetectingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Fallback to business profile default or first market
        if (businessProfile?.default_market_id) {
          const market = locationMarkets.find(m => m.id === businessProfile.default_market_id);
          if (market) setSelectedMarket(market);
        } else if (locationMarkets.length > 0) {
          setSelectedMarket(locationMarkets[0]);
        }
        setDetectingLocation(false);
      }
    );
  };

  // Load user posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!user?.id || adType !== 'promoted_post') return;
      setLoadingPosts(true);
      const posts = await getUserPosts(user.id);
      setUserPosts(posts);
      setLoadingPosts(false);
    };

    if (open) {
      loadPosts();
    }
  }, [open, user?.id, adType, getUserPosts]);

  const selectedPost = userPosts.find(p => p.id === selectedPostId);
  const estimatedReach = Math.round(5000 * (dailyBudget / 10)); // Simplified reach estimate
  const endDate = addDays(new Date(), duration);

  const handleSubmit = async () => {
    if (!businessProfile || !selectedMarket) return;

    // Check credits before starting
    if (businessProfile.credit_balance < totalBudget) {
      toast.error(uiText("Créditos insuficientes"));
      return;
    }

    setIsSubmitting(true);

    const ad = await createAdvertisement({
      ad_type: adType,
      post_id: selectedPostId,
      title: adType === 'business_profile' ? title : selectedPost?.content?.substring(0, 100),
      description,
      call_to_action: callToAction,
      cta_url: ctaUrl,
      target_market_id: selectedMarket.id,
      target_city: selectedMarket.city,
      target_neighborhood: selectedMarket.neighborhood,
      daily_budget: dailyBudget,
      total_budget: totalBudget,
      ends_at: endDate.toISOString(),
    });

    // Auto-activate for MVP - pass the full ad object
    if (ad) {
      await activateAdvertisementDirect(ad);
    }

    setIsSubmitting(false);
    onOpenChange(false);
  };

  // Direct activation without relying on state
  const activateAdvertisementDirect = async (ad: Advertisement) => {
    if (!businessProfile) return null;

    const newBalance = businessProfile.credit_balance - ad.total_budget;

    // Deduct credits
    const { error: balanceError } = await supabase
      .from('business_profiles')
      .update({ credit_balance: newBalance })
      .eq('id', businessProfile.id);

    if (balanceError) {
      console.error('Error deducting credits:', balanceError);
      toast.error(uiText("Erro ao deduzir créditos"));
      return null;
    }

    // Record transaction
    await supabase.from('credit_transactions').insert({
      business_id: businessProfile.id,
      transaction_type: 'spend',
      amount: -ad.total_budget,
      balance_after: newBalance,
      description: uiText("Destaque: {{value1}}", { value1: (ad.title || 'Publicação') ?? "" }),
    });

    // Activate the ad
    const { error: activateError } = await supabase
      .from('advertisements')
      .update({ status: 'active' })
      .eq('id', ad.id);

    if (activateError) {
      console.error('Error activating ad:', activateError);
      toast.error(uiText("Erro ao ativar anúncio"));
      return null;
    }

    // Refresh business profile to update balance
    fetchBusinessProfile();
    toast.success(uiText("Destaque ativado com sucesso!"));
    return ad;
  };

  const ctaOptions = [
    'Saber mais',
    'Comprar agora',
    'Reservar',
    'Ligar',
    'Ver menu',
    'Obter direções',
    'Enviar mensagem',
    'Ver oferta',
  ];

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">{uiText("O que queres destacar?")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{uiText("Escolhe o tipo de destaque local")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card
          className={`p-4 cursor-pointer transition-all ${
            adType === 'promoted_post'
              ? 'border-primary bg-primary/5 ring-2 ring-primary'
              : 'hover:border-primary/50'
          }`}
          onClick={() => setAdType('promoted_post')}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-medium">{uiText("Destacar Post")}</h4>
            <p className="text-xs text-muted-foreground mt-1">{uiText("Dá mais visibilidade a uma publicação")}</p>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            adType === 'business_profile'
              ? 'border-primary bg-primary/5 ring-2 ring-primary'
              : 'hover:border-primary/50'
          }`}
          onClick={() => setAdType('business_profile')}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-medium">{uiText("Destacar Negócio")}</h4>
            <p className="text-xs text-muted-foreground mt-1">{uiText("Aparece na secção de descoberta")}</p>
          </div>
        </Card>
      </div>

      {adType === 'promoted_post' && (
        <div className="space-y-3">
          <Label>{uiText("Seleciona um post")}</Label>
          {loadingPosts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : userPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Image className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{uiText("Ainda não tens posts")}</p>
            </div>
          ) : (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {userPosts.map((post) => (
                  <Card
                    key={post.id}
                    className={`p-3 cursor-pointer transition-all ${
                      selectedPostId === post.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPostId(post.id)}
                  >
                    <div className="flex gap-3">
                      {post.media_urls?.[0] && (
                        <img
                          src={post.media_urls[0]}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{post.content || uiText("Sem texto")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{uiText("{{value1}} gostos • {{value2}} comentários", { value1: (post.likes_count) ?? "", value2: (post.comments_count) ?? "" })}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {adType === 'business_profile' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{uiText("Título do destaque")}</Label>
            <Input
              id="title"
              placeholder={uiText("Ex: Promoção especial esta semana!")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{uiText("Descrição")}</Label>
            <Textarea
              id="description"
              placeholder={uiText("Descreve a tua oferta...")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}

      <Button
        onClick={() => setStep(2)}
        disabled={adType === 'promoted_post' && !selectedPostId}
        className="w-full"
      >{uiText("Continuar")}<ChevronRight className="w-4 h-4 ml-2" />
      </Button>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">{uiText("Área local")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{uiText("Escolhe onde o destaque será visível")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{uiText("Zona")}</Label>
          <Select
            value={selectedMarket?.id || ''}
            onValueChange={(id) => {
              const market = locationMarkets.find(m => m.id === id);
              setSelectedMarket(market || null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={detectingLocation ? uiText("A detetar...") : uiText("Seleciona a zona")} />
            </SelectTrigger>
            <SelectContent>
              {locationMarkets.map((market) => (
                <SelectItem key={market.id} value={market.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {market.display_name}
                  </div>
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
            )}{uiText("Gerar o meu endereço AFROLOC")}</Button>

          <p className="text-xs text-muted-foreground text-center">{uiText("O destaque aparecerá para utilizadores em {{value1}}", { value1: (selectedMarket?.display_name || uiText("esta zona")) ?? "" })}</p>
        </div>

        <div className="space-y-2">
          <Label>{uiText("Chamada para ação")}</Label>
          <Select value={callToAction} onValueChange={setCallToAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ctaOptions.map((cta) => (
                <SelectItem key={cta} value={cta}>
                  {cta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {callToAction !== 'Ligar' && (
          <div className="space-y-2">
            <Label htmlFor="ctaUrl">{uiText("Link (opcional)")}</Label>
            <Input
              id="ctaUrl"
              placeholder="https://..."
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">{uiText("Voltar")}</Button>
        <Button onClick={() => setStep(3)} disabled={!selectedMarket} className="flex-1">{uiText("Continuar")}<ChevronRight className="w-4 h-4 ml-2" />
        </Button>
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
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">{uiText("Orçamento e Duração")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{uiText("Define quanto queres investir")}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>{uiText("Orçamento diário")}</Label>
            <span className="text-sm font-medium">{uiText("{{value1}} créditos", { value1: (dailyBudget) ?? "" })}</span>
          </div>
          <Slider
            value={[dailyBudget]}
            onValueChange={([v]) => {
              setDailyBudget(v);
              setTotalBudget(v * duration);
            }}
            min={50}
            max={500}
            step={10}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>{uiText("Duração")}</Label>
            <span className="text-sm font-medium">{uiText("{{value1}} dias", { value1: (duration) ?? "" })}</span>
          </div>
          <Slider
            value={[duration]}
            onValueChange={([v]) => {
              setDuration(v);
              setTotalBudget(dailyBudget * v);
            }}
            min={1}
            max={30}
            step={1}
          />
          <p className="text-xs text-muted-foreground">{uiText("Até {{value1}}", { value1: (format(endDate, "d 'de' MMMM", { locale: pt })) ?? "" })}</p>
        </div>

        {/* Summary card */}
        <Card className="p-4 bg-secondary/30 border-dashed">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{uiText("Orçamento total")}</span>
              <span className="font-medium">{uiText("{{value1}} créditos", { value1: (totalBudget) ?? "" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{uiText("Alcance estimado")}</span>
              <span className="font-medium">{uiText("~{{value1}} pessoas", { value1: (estimatedReach.toLocaleString(uiLocale())) ?? "" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{uiText("Zona")}</span>
              <span className="font-medium">{selectedMarket?.display_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{uiText("Saldo disponível")}</span>
              <span className={`font-medium ${
                (businessProfile?.credit_balance || 0) < totalBudget ? 'text-destructive' : 'text-green-600'
              }`}>{uiText("{{value1}} créditos", { value1: (businessProfile?.credit_balance || 0) ?? "" })}</span>
            </div>
          </div>
        </Card>

        {(businessProfile?.credit_balance || 0) < totalBudget && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{uiText("Créditos insuficientes. Reduz o orçamento ou adiciona mais créditos.")}</div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)} className="flex-1">{uiText("Voltar")}</Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || (businessProfile?.credit_balance || 0) < totalBudget}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />{uiText("Publicar Destaque")}</>
          )}
        </Button>
      </div>
    </motion.div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />{uiText("Criar Destaque Local")}</SheetTitle>
        </SheetHeader>

        {/* Progress */}
        <div className="flex gap-2 mb-6 shrink-0">
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
