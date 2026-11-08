import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { useMyMentor } from '../hooks/useMentorGovernance';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, AlertTriangle, ChevronRight, Type, FileText, LayoutGrid, Coins, Calendar, Users, Crown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ACADEMIA_COPY } from '../copy';
import { useCreateAcademiaSession } from '../hooks/useAcademia';
import { useAfrolocCertification } from '@/features/kumbu/hooks/useAfrolocCertification';

const STEPS = [
  { key: 'title', get label() { return uiText("Título"); }, icon: Type },
  { key: 'description', get label() { return uiText("Descrição"); }, icon: FileText },
  { key: 'format', get label() { return uiText("Formato"); }, icon: LayoutGrid },
  { key: 'price', get label() { return uiText("Detalhes"); }, icon: Coins },
] as const;

// Valor por defeito para o campo de data/hora: amanhã às 18:00, no formato
// `YYYY-MM-DDTHH:mm` que o input datetime-local exige (assim o campo nunca
// fica incompleto e o botão Publicar não fica preso).
function defaultDatetimeLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const FORMAT_OPTIONS = [
  { value: '1:1', label: ACADEMIA_COPY.format1on1, desc: 'Sessão privada, 1 vaga', emoji: '🎯' },
  { value: 'grupo', label: ACADEMIA_COPY.formatGroup, desc: 'Para a banda toda', emoji: '👥' },
  { value: 'masterclass', label: ACADEMIA_COPY.formatMasterclass, desc: 'Apresentação aberta', emoji: '🎓' },
];

export default function AcademiaCreateSession() {
  useUiLocale();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<string>('grupo');
  const [spots, setSpots] = useState('20');
  const [priceCoins, setPriceCoins] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [datetime, setDatetime] = useState(defaultDatetimeLocal);

  const createMutation = useCreateAcademiaSession();
  const mentor = useMyMentor();
  const { isCertified } = useAfrolocCertification();
  const price = Number(priceCoins) || 0;

  // Data/hora válida = completa (data + hora) e no futuro.
  const datetimeValid = useMemo(() => {
    if (!datetime) return false;
    const t = new Date(datetime).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [datetime]);

  const handleFormatChange = (value: string) => {
    setFormat(value);
    if (value === '1:1') {
      setSpots('1');
    } else if (spots === '1') {
      setSpots('20');
    }
  };

  const canNext = useMemo(() => {
    switch (step) {
      case 0: return title.trim().length >= 3;
      case 1: return true; // description optional
      case 2: return !!format;
      case 3: return datetimeValid;
      default: return false;
    }
  }, [step, title, format, datetimeValid]);

  const isLastStep = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      navigate(-1);
    } else {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    if (mentor.data?.status !== 'active' || (price > 0 && !mentor.data.is_verified_mentor)) {
      toast.error(uiText("Aprovação necessária; para cobrar, precisas também da verificação de mentor.")); return;
    }
    if (!datetimeValid) {
      toast.error(uiText("Escolhe uma data e hora futuras para a sessão."));
      return;
    }
    createMutation.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        format,
        spots: Number(spots) || 20,
        priceCoins: price,
        scheduledAt: new Date(datetime).toISOString(),
        durationMinutes: Number(durationMinutes),
      },
      {
        onSuccess: () => {
          toast.success(uiText("Sessão criada!"));
          navigate('/academia');
        },
        onError: (err) => {
          toast.error('Erro ao criar sessão: ' + (err as Error).message);
        },
      }
    );
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  const [direction, setDirection] = useState(1);

  const goNext = () => { setDirection(1); handleNext(); };
  const goBack = () => { setDirection(-1); handleBack(); };

  if (mentor.isLoading) return <p className="p-6">{uiText("A verificar o perfil de mentor…")}</p>;
  if (mentor.isError) return <div className="p-6"><p>{uiText("Não foi possível verificar o perfil.")}</p><Button onClick={() => mentor.refetch()}>{uiText("Tentar novamente")}</Button></div>;
  if (mentor.data?.status !== 'active') return <div className="p-6 space-y-4"><h1 className="font-semibold">{uiText("Aprovação de mentor necessária")}</h1><p>{uiText("Apresenta ou completa a candidatura na Academia. As sessões existentes mantêm o histórico.")}</p><Button onClick={() => navigate('/academia')}>{uiText("Ir à Academia")}</Button></div>;

  return (
    <div className="flex flex-col h-screen-safe overflow-hidden bg-background">
      {/* Header */}
      <header className="relative shrink-0 z-30 glass-nav px-4 safe-top">
        <div className="flex items-center gap-3 h-14">
          <button onClick={goBack} className="p-1.5 -ml-1 rounded-lg hover:bg-card transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4.5 w-4.5 text-primary" />
            <h1 className="text-sm font-bold text-foreground">{ACADEMIA_COPY.createSession}</h1>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 pb-3">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.key} className="flex items-center gap-1.5 flex-1">
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-lg text-[10px] font-bold transition-all duration-300 shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : isDone
                        ? 'bg-success/15 text-success'
                        : 'bg-card text-muted-foreground border border-border/30'
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-[2px] flex-1 rounded-full transition-all duration-500 ${
                    isDone ? 'bg-success/40' : 'bg-border/40'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </header>

      {/* Step content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-6 pb-32">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* Step 0: Title */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-foreground">{uiText("Como se chama a tua sessão?")}</h2>
                  <p className="text-xs text-muted-foreground">{uiText("Escolhe um título claro e atrativo.")}</p>
                </div>
                <div className="space-y-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={uiText("Ex.: Produção musical com Ableton")}
                    maxLength={100}
                    className="h-12 text-base"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground/50 text-right">{title.length}/100</p>
                </div>
              </div>
            )}

            {/* Step 1: Description */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-foreground">{uiText("Do que vais falar?")}</h2>
                  <p className="text-xs text-muted-foreground">{uiText("Descreve o que a banda pode esperar.")}</p>
                </div>
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={uiText("Descreve o conteúdo, os objectivos e o que a malta vai aprender...")}
                    rows={5}
                    maxLength={500}
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground/50 text-right">{description.length}/500</p>
                </div>
              </div>
            )}

            {/* Step 2: Format */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-foreground">{uiText("Qual é o formato?")}</h2>
                  <p className="text-xs text-muted-foreground">{uiText("Escolhe como queres organizar a sessão.")}</p>
                </div>
                <div className="space-y-3">
                  {FORMAT_OPTIONS.map((opt) => (
                    <motion.div
                      key={opt.value}
                      whileTap={{ scale: 0.97 }}
                      className={`rounded-2xl border p-4 cursor-pointer transition-all duration-200 ${
                        format === opt.value
                          ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(212,175,55,0.08)]'
                          : 'border-border/30 bg-card hover:border-border/50'
                      }`}
                      onClick={() => handleFormatChange(opt.value)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{opt.emoji}</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          format === opt.value
                            ? 'border-primary bg-primary'
                            : 'border-border/50'
                        }`}>
                          {format === opt.value && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {format !== '1:1' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <Label htmlFor="spots" className="text-xs">{uiText("Número de lugares")}</Label>
                    <Input
                      id="spots"
                      type="number"
                      min={2}
                      max={100}
                      value={spots}
                      onChange={(e) => setSpots(e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
            )}

            {/* Step 3: Price + datetime */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-foreground">{uiText("Detalhes finais")}</h2>
                  <p className="text-xs text-muted-foreground">{uiText("Define o preço e a data da sessão.")}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-xs flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-primary" />{uiText("Preço (coins)")}</Label>
                    <Input
                      id="price"
                      disabled={!mentor.data.is_verified_mentor}
                      type="number"
                      min={0}
                      value={priceCoins}
                      onChange={(e) => setPriceCoins(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground/50">{uiText("0 = sessão gratuita. Só mentores verificados podem cobrar.")}</p>
                  </div>

                  {price > 0 && !isCertified && (
                    <Alert className="bg-primary/10 border-primary/30 rounded-xl">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-xs">{uiText("Podes publicar já. Para ")}<strong>{uiText("receberes")}</strong>{uiText(" os pagamentos vais precisar de verificar o teu endereço AFROLOC — fá-lo em Definições quando quiseres.")}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="duration">{uiText("Duração prevista")}</Label>
                    <select id="duration" value={durationMinutes} onChange={e=>setDurationMinutes(e.target.value)} className="w-full rounded-lg border border-border bg-background p-3">
                      {[30,45,60,90,120].map(minutes=><option key={minutes} value={minutes}>{uiText("{{value1}} minutos", { value1: (minutes) ?? "" })}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground">{uiText("O tempo começa ao iniciar a sala. O fim da duração prevista não encerra a sessão nem gera cobrança automática.")}</p>
                    <Label htmlFor="datetime" className="text-xs flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />{uiText("Agendar ")}<span className="text-muted-foreground font-normal">{uiText("(data e hora)")}</span>
                    </Label>
                    <Input
                      id="datetime"
                      type="datetime-local"
                      value={datetime}
                      onChange={(e) => setDatetime(e.target.value)}
                    />
                    {!datetimeValid && (
                      <p className="text-[11px] text-destructive">{uiText("Escolhe uma data e hora futuras.")}</p>
                    )}
                  </div>
                </div>

                {/* Preview card */}
                {title.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{uiText("Pré-visualização")}</p>
                    <Card className="border-border/30 overflow-hidden">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground leading-tight flex-1">{title}</h3>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {price > 0 ? (
                              <Badge className="bg-primary/15 text-primary text-[10px] px-2 py-0.5 rounded-full border-0 gap-1">
                                <Crown className="h-2.5 w-2.5" />{uiText("Premium")}</Badge>
                            ) : (
                              <Badge className="bg-success/15 text-success text-[10px] px-2 py-0.5 rounded-full border-0">{uiText("Gratuita")}</Badge>
                            )}
                          </div>
                        </div>

                        {description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{description}</p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] text-muted-foreground bg-secondary rounded-md px-2 py-0.5 capitalize font-medium">
                            {format}
                          </span>
                          {datetime && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(datetime).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" />{uiText("{{value1}} vagas", { value1: (spots) ?? "" })}</span>
                          {price > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                              <Coins className="h-3 w-3" />{price}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 glass-nav p-4 safe-bottom">
        <Button
          className="w-full rounded-full h-11 gap-1.5 text-sm font-semibold"
          disabled={!canNext || createMutation.isPending}
          onClick={goNext}
        >
          {createMutation.isPending
            ? uiText("A criar...")
            : isLastStep
              ? uiText("Publicar sessão")
              : (
                <>{uiText("Continuar")}<ChevronRight className="h-4 w-4" />
                </>
              )
          }
        </Button>

        {/* Step counter */}
        <p className="text-center text-[10px] text-muted-foreground/50 mt-2">{uiText("Passo {{value1}} de {{value2}}", { value1: (step + 1), value2: (STEPS.length) ?? "" })}</p>
      </div>
    </div>
  );
}
