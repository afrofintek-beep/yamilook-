import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MapPin,
  Phone,
  BadgeCheck,
  Sparkles,
  Zap,
  Coins,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  X,
  Save,
  Users,
  TrendingUp,
  Star,
  ArrowLeft
} from 'lucide-react';
import { Advertisement, BusinessProfile, useAdvertising } from '@/hooks/useAdvertising';
import { toast } from 'sonner';

interface AdPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad: Advertisement;
  businessProfile: BusinessProfile | null;
  onConfirmActivate: () => Promise<unknown>;
  onViewCredits?: () => void;
  onViewBudget?: () => void;
}

export function AdPreviewDialog({
  open,
  onOpenChange,
  ad,
  businessProfile,
  onConfirmActivate,
  onViewCredits,
  onViewBudget
}: AdPreviewDialogProps) {
  useUiLocale();
  const { updateAdvertisement } = useAdvertising();
  const [isActivating, setIsActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [editTitle, setEditTitle] = useState(ad.title || '');
  const [editDescription, setEditDescription] = useState(ad.description || '');
  const [editCta, setEditCta] = useState(ad.call_to_action || '');
  const [editBudget, setEditBudget] = useState(ad.total_budget);
  const [editBudgetInput, setEditBudgetInput] = useState(ad.total_budget.toString());

  // Reset form when ad changes
  useEffect(() => {
    setEditTitle(ad.title || '');
    setEditDescription(ad.description || '');
    setEditCta(ad.call_to_action || '');
    setEditBudget(ad.total_budget);
    setEditBudgetInput(ad.total_budget.toString());
    setIsEditing(false);
    setActivated(false);
  }, [ad]);

  // Use ad-specific data first, then fall back to business profile
  const business = ad.business || businessProfile;

  // For display, prefer ad-specific title/description over business defaults
  const displayTitle = ad.title || business?.business_name || 'Negócio local';
  const displayDescription = ad.description || business?.description || '';

  const currentBudget = isEditing ? editBudget : ad.total_budget;
  const hasEnoughCredits = (businessProfile?.credit_balance || 0) >= currentBudget;

  // Reach estimation based on budget
  // Using realistic CPM (cost per 1000 impressions) estimates
  const CPM_ESTIMATE = 5; // 5 credits per 1000 impressions
  const estimatedImpressions = Math.round((currentBudget / CPM_ESTIMATE) * 1000);
  const estimatedReachMin = Math.round(estimatedImpressions * 0.4); // ~40% unique reach
  const estimatedReachMax = Math.round(estimatedImpressions * 0.6); // ~60% unique reach

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      await updateAdvertisement(ad.id, {
        title: editTitle,
        description: editDescription,
        call_to_action: editCta || null,
        total_budget: editBudget,
      });
      setIsEditing(false);
      toast.success(uiText("Alterações guardadas!"));
    } catch (error) {
      toast.error(uiText("Erro ao guardar alterações"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(ad.title || '');
    setEditDescription(ad.description || '');
    setEditCta(ad.call_to_action || '');
    setEditBudget(ad.total_budget);
    setIsEditing(false);
  };

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await onConfirmActivate();
      setActivated(true);
      setTimeout(() => {
        onOpenChange(false);
        setActivated(false);
      }, 1500);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2"
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Eye className="w-5 h-5 text-primary" />
              {isEditing ? uiText("Editar Destaque") : uiText("Prévia do Destaque")}
            </span>
            {!isEditing && !activated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8"
              >
                <Pencil className="w-4 h-4 mr-1" />{uiText("Editar")}</Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? uiText("Edita os detalhes do teu anúncio antes de ativar")
              : uiText("Revisa como o teu anúncio vai aparecer para os utilizadores")
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-4 pb-4">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div
                  key="edit-mode"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Edit Form */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit-title" className="text-xs">{uiText("Título do anúncio")}</Label>
                      <Input
                        id="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={uiText("Ex: Promoção de Verão!")}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-description" className="text-xs">{uiText("Descrição")}</Label>
                      <Textarea
                        id="edit-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={uiText("Descreve o teu negócio ou promoção...")}
                        className="mt-1 min-h-[80px]"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-cta" className="text-xs">{uiText("Botão de ação (opcional)")}</Label>
                      <Input
                        id="edit-cta"
                        value={editCta}
                        onChange={(e) => setEditCta(e.target.value)}
                        placeholder={uiText("Ex: Ver mais, Contactar, Reservar...")}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-budget" className="text-xs">{uiText("Orçamento em créditos")}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="edit-budget"
                          type="text"
                          inputMode="numeric"
                          value={editBudgetInput}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setEditBudgetInput(value);
                            const numValue = parseInt(value) || 0;
                            setEditBudget(numValue);
                          }}
                          onBlur={() => {
                            const numValue = parseInt(editBudgetInput) || 100;
                            const finalValue = Math.max(100, numValue);
                            setEditBudget(finalValue);
                            setEditBudgetInput(finalValue.toString());
                          }}
                          className="w-32"
                        />
                        <span className="text-xs text-muted-foreground">{uiText("mínimo 100")}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Preview with edits */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Eye className="w-3 h-3" />{uiText("Prévia das alterações")}</p>
                    <Card className="overflow-hidden border border-dashed">
                      <div className="p-3">
                        <div className="flex items-start gap-3 mb-2">
                          <Avatar className="w-10 h-10 border-2 border-background">
                            <AvatarImage src={business?.logo_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                              {business?.business_name?.charAt(0) || 'N'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">
                              {business?.business_name || uiText("Negócio local")}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {editDescription || business?.description || uiText("Sem descrição")}
                            </p>
                          </div>
                        </div>
                        {editCta && (
                          <Button className="w-full" size="sm" variant="outline">
                            {editCta}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Edit Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X className="w-4 h-4 mr-1" />{uiText("Cancelar")}</Button>
                    <Button
                      className="flex-1"
                      onClick={handleSaveEdits}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Save className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-1" />{uiText("Guardar")}</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="preview-mode"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {/* Preview Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />{uiText("Assim aparecerá na secção \"Destaques Locais\"")}</p>

                    <Card className="overflow-hidden border-2 border-primary/20">
                      {/* Cover image */}
                      {business?.cover_image_url ? (
                        <div className="relative h-28 bg-gradient-to-br from-primary/20 to-primary/5">
                          <img
                            src={business.cover_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <Badge
                            className="absolute top-2 right-2 text-[10px] bg-primary/10 text-primary border-0"
                            variant="secondary"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />{uiText("Destaque Local")}</Badge>
                        </div>
                      ) : (
                        <div className="relative h-28 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <span className="text-4xl font-bold text-primary/30">
                            {business?.business_name?.charAt(0) || 'N'}
                          </span>
                          <Badge
                            className="absolute top-2 right-2 text-[10px] bg-primary/10 text-primary border-0"
                            variant="secondary"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />{uiText("Destaque Local")}</Badge>
                        </div>
                      )}

                      {/* Content */}
                      <div className="p-3">
                        <div className="flex items-start gap-3 mb-2">
                          <Avatar className="w-12 h-12 -mt-8 border-3 border-background shadow-lg">
                            <AvatarImage src={business?.logo_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                              {business?.business_name?.charAt(0) || 'N'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center gap-1">
                              <h3 className="font-semibold text-sm truncate">
                                {displayTitle}
                              </h3>
                              {business?.is_verified && (
                                <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                              )}
                            </div>
                            {business?.business_category && (
                              <Badge variant="outline" className="text-[10px] mt-0.5">
                                {business.business_category}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {displayDescription && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {displayDescription}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {(ad.target_city || business?.city) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{ad.target_city || business?.city}</span>
                            </div>
                          )}
                          {business?.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{uiText("Contactar")}</span>
                            </div>
                          )}
                        </div>

                        {ad.call_to_action && (
                          <Button
                            className="w-full mt-3"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (ad.cta_url) {
                                window.open(ad.cta_url, '_blank', 'noopener,noreferrer');
                              } else if (business?.website) {
                                window.open(business.website, '_blank', 'noopener,noreferrer');
                              } else if (business?.phone) {
                                window.open(`tel:${business.phone}`, '_self');
                              }
                            }}
                          >
                            {ad.call_to_action}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>

                  <Separator className="my-4" />

                  {/* Reach Estimation */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-4"
                  >
                    <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />{uiText("Estimativa de alcance")}</h4>

                    <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{uiText("Impressões previstas")}</p>
                            <p className="text-xl font-bold text-primary">
                              {estimatedImpressions.toLocaleString(uiLocale())}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{uiText("Pessoas alcançadas")}</p>
                          <p className="text-sm font-semibold">
                            {estimatedReachMin.toLocaleString(uiLocale())} - {estimatedReachMax.toLocaleString(uiLocale())}
                          </p>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((currentBudget / 1000) * 100, 100)}%` }}
                          transition={{ delay: 0.3, duration: 0.5 }}
                          className="absolute h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                        <span>0</span>
                        <span>{uiText("Orçamento: {{value1}} créditos", { value1: (currentBudget) ?? "" })}</span>
                        <span>1000+</span>
                      </div>
                    </Card>

                    {/* Budget Comparison */}
                    <div className="mt-4">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2">{uiText("Compare orçamentos sugeridos:")}</h5>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Economic */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => isEditing && setEditBudget(200)}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            currentBudget === 200
                              ? 'border-success bg-success/10'
                              : 'border-muted hover:border-success/50 bg-muted/30'
                          } ${!isEditing && 'cursor-default'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Coins className="w-3 h-3 text-success" />
                            <span className="text-[10px] font-semibold text-success">{uiText("Económico")}</span>
                          </div>
                          <p className="text-sm font-bold">200</p>
                          <p className="text-[10px] text-muted-foreground">{uiText("créditos")}</p>
                          <div className="mt-2 pt-2 border-t border-muted">
                            <p className="text-[10px] text-muted-foreground">{uiText("~{{value1}} impressões", { value1: (Math.round((200 / CPM_ESTIMATE) * 1000).toLocaleString(uiLocale())) ?? "" })}</p>
                            <p className="text-[10px] text-muted-foreground">{uiText("~{{value1}} pessoas", { value1: (Math.round((200 / CPM_ESTIMATE) * 1000 * 0.5).toLocaleString(uiLocale())) ?? "" })}</p>
                          </div>
                        </motion.button>

                        {/* Recommended */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => isEditing && setEditBudget(500)}
                          className={`p-3 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                            currentBudget === 500
                              ? 'border-primary bg-primary/10'
                              : 'border-primary/30 hover:border-primary/60 bg-primary/5'
                          } ${!isEditing && 'cursor-default'}`}
                        >
                          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-bl font-medium">{uiText("Popular")}</div>
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-semibold text-primary">{uiText("Recomendado")}</span>
                          </div>
                          <p className="text-sm font-bold">500</p>
                          <p className="text-[10px] text-muted-foreground">{uiText("créditos")}</p>
                          <div className="mt-2 pt-2 border-t border-primary/20">
                            <p className="text-[10px] text-muted-foreground">{uiText("~{{value1}} impressões", { value1: (Math.round((500 / CPM_ESTIMATE) * 1000).toLocaleString(uiLocale())) ?? "" })}</p>
                            <p className="text-[10px] text-muted-foreground">{uiText("~{{value1}} pessoas", { value1: (Math.round((500 / CPM_ESTIMATE) * 1000 * 0.5).toLocaleString(uiLocale())) ?? "" })}</p>
                          </div>
                        </motion.button>

                        {/* Premium */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => isEditing && setEditBudget(1000)}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            currentBudget === 1000
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5'
                          } ${!isEditing && 'cursor-default'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] font-semibold text-amber-500">{uiText("Premium")}</span>
                          </div>
                          <p className="text-sm font-bold">1000</p>
                          <p className="text-[10px] text-muted-foreground">{uiText("créditos")}</p>
                          <div className="mt-2 pt-2 border-t border-amber-500/20">
                            <p className="text-[10px] text-muted-foreground">{uiText("~{{value1}} impressões", { value1: (Math.round((1000 / CPM_ESTIMATE) * 1000).toLocaleString(uiLocale())) ?? "" })}</p>
                            <p className="text-[10px] text-muted-foreground">{uiText("~{{value1}} pessoas", { value1: (Math.round((1000 / CPM_ESTIMATE) * 1000 * 0.5).toLocaleString(uiLocale())) ?? "" })}</p>
                          </div>
                        </motion.button>
                      </div>
                      {isEditing && (
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">{uiText("Clique num plano para selecionar ou use o campo acima para um valor personalizado")}</p>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-3 italic">{uiText("* Estimativa baseada no custo médio de ~{{value1}} créditos por 1.000 impressões", { value1: (CPM_ESTIMATE) ?? "" })}</p>
                  </motion.div>

                  <Separator className="my-4" />

                  {/* Cost Summary */}
                  <div className="space-y-3 mb-4">
                    <h4 className="font-semibold text-sm">{uiText("Resumo de custos")}</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className="p-3 bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
                          onClick={() => {
                            if (onViewBudget) {
                              onOpenChange(false);
                              onViewBudget();
                            }
                          }}
                        >
                          <p className="text-xs text-muted-foreground">{uiText("Orçamento total")}</p>
                          <p className="text-lg font-bold flex items-center gap-1">
                            <Coins className="w-4 h-4 text-primary" />
                            {ad.total_budget}
                          </p>
                        </Card>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className="p-3 bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
                          onClick={() => {
                            if (onViewCredits) {
                              onOpenChange(false);
                              onViewCredits();
                            }
                          }}
                        >
                          <p className="text-xs text-muted-foreground">{uiText("Teus créditos")}</p>
                          <p className={`text-lg font-bold flex items-center gap-1 ${!hasEnoughCredits ? 'text-destructive' : ''}`}>
                            <Coins className="w-4 h-4" />
                            {businessProfile?.credit_balance || 0}
                          </p>
                        </Card>
                      </motion.div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{uiText("Público-alvo: {{value1}}{{value2}}", { value1: (ad.target_city) ?? "", value2: (ad.target_neighborhood ? ` - ${ad.target_neighborhood}` : '') })}</span>
                    </div>
                  </div>

                  {/* Warning or Success */}
                  <AnimatePresence mode="wait">
                    {!hasEnoughCredits ? (
                      <motion.div
                        key="warning"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive mb-4"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p className="text-xs">{uiText("Créditos insuficientes. Precisas de {{value1}} créditos adicionais.", { value1: (ad.total_budget - (businessProfile?.credit_balance || 0)) })}</p>
                      </motion.div>
                    ) : activated ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 mb-4"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <p className="text-xs font-medium">{uiText("Destaque ativado com sucesso! 🎉")}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onOpenChange(false)}
                      disabled={isActivating}
                    >{uiText("Cancelar")}</Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                      onClick={handleActivate}
                      disabled={!hasEnoughCredits || isActivating || activated}
                    >
                      {isActivating ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Zap className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-1" />{uiText("Ativar por {{value1}} créditos", { value1: (ad.total_budget) ?? "" })}</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
