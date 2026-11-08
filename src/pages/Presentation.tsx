import { uiText, useUiLocale } from '@/i18n/ui-copy';
import KosololaLogo from '@/components/brand/KosololaLogo';
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import YamilookLogo from "@/components/brand/YamilookLogo";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  FileDown,
  MessageCircle,
  Phone,
  Users,
  Radio,
  Music,
  GraduationCap,
  Coins,
  Shield,
  Globe,
  Megaphone,
  Home,
  Camera,
  Heart,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────── Slide data ────────────────────── */

interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  icon?: React.ReactNode;
  accent?: string; // tailwind bg class using tokens
  visual?: "logo" | "reactions" | "mokubico" | "closing";
}

const getSlides = (): Slide[] => [
  {
    id: "cover",
    title: "yamilook",
    subtitle: uiText("A vida como ela é."),
    visual: "logo",
  },
  {
    id: "mission",
    title: uiText("A nossa missão"),
    subtitle:
      uiText("Criar a primeira super-app social africana — feita por angolanos, para a banda toda."),
    bullets: [
      uiText("Comunidade local em primeiro lugar"),
      uiText("Cultura africana como identidade, não decoração"),
      uiText("Privacidade e respeito como valores fundamentais"),
    ],
    icon: <Heart className="h-10 w-10" />,
  },
  {
    id: "feed",
    title: uiText("Muxi — Feed Social"),
    subtitle: uiText("Partilha momentos, ideias e vibes com a tua banda."),
    bullets: [
      uiText("Publicações com fotos, vídeos e texto"),
      uiText("Sistema de Reações Africanas exclusivo"),
      uiText("Tópicos de descoberta e trending"),
      uiText("Stories que desaparecem em 24h"),
    ],
    icon: <Camera className="h-10 w-10" />,
  },
  {
    id: "reactions",
    title: uiText("Reações Africanas"),
    subtitle: uiText("Emoções com significado cultural, não apenas emojis genéricos."),
    visual: "reactions",
    bullets: [
      uiText("🪘 Djembe — Celebração"),
      uiText("❤️ Sankofa Love — Amor profundo"),
      uiText("🤝 Ubuntu — Solidariedade"),
      uiText("⚡ Shango — Poder e força"),
      uiText("😤 Eish — Desconforto"),
    ],
  },
  {
    id: "chat",
    title: uiText("KOSOLOLA — Conversas"),
    subtitle: uiText("Conversas privadas e em grupo, com todo o mambo."),
    bullets: [
      uiText("Mensagens de texto, áudio e vídeo"),
      uiText("Grupos com administração avançada"),
      uiText("Mensagens que desaparecem"),
      uiText("Reações, respostas e encaminhamento"),
      uiText("GIFs, stickers e formatação rica"),
    ],
    icon: <KosololaLogo className="h-10 w-10" />,
  },
  {
    id: "calls",
    title: uiText("Chamadas"),
    subtitle: uiText("Voz e vídeo de alta qualidade com a tua banda."),
    bullets: [
      uiText("Chamadas individuais e em grupo"),
      uiText("Vídeo com fundos virtuais"),
      uiText("Gravação de chamadas"),
      uiText("Sala de espera e controlo de anfitrião"),
      uiText("Salas breakout para grupos grandes"),
    ],
    icon: <Phone className="h-10 w-10" />,
  },
  {
    id: "live",
    title: uiText("Live — Transmissões ao Vivo"),
    subtitle: uiText("Vai ao vivo e conecta-te com a tua comunidade em tempo real."),
    bullets: [
      uiText("Streaming de áudio e vídeo"),
      uiText("Chat ao vivo e reações"),
      uiText("Gestão de participantes"),
      uiText("Integração com Palco e Mokubico"),
    ],
    icon: <Radio className="h-10 w-10" />,
  },
  {
    id: "mokubico",
    title: "MOKUBICO",
    subtitle: uiText("Onde a tua banda vive — espaços de convívio por áudio."),
    visual: "mokubico",
    bullets: [
      uiText("🌴 Quintal — Conversas abertas para todos"),
      uiText("🛋️ Sala — Rodas íntimas entre kambas"),
      uiText("🍳 Cozinha das Sis — Espaço seguro feminino"),
      uiText("🔒 Quarto — Privacidade total a dois"),
    ],
  },
  {
    id: "ritmos",
    title: uiText("Ritmos"),
    subtitle: uiText("Vídeos curtos com o ritmo de Angola."),
    bullets: [
      uiText("Criação rápida de vídeos curtos"),
      uiText("Efeitos e filtros africanos"),
      uiText("Feed vertical tipo TikTok"),
      uiText("Partilha direta para o feed e stories"),
    ],
    icon: <Music className="h-10 w-10" />,
  },
  {
    id: "palco",
    title: uiText("Palco"),
    subtitle: uiText("O teu espaço de criação e performance ao vivo."),
    bullets: [
      uiText("Criação de palcos temáticos"),
      uiText("Rodas de conversa moderadas"),
      uiText("Sistema de Vozes para co-criação"),
      uiText("Dashboard de gestão para criadores"),
    ],
    icon: <Zap className="h-10 w-10" />,
  },
  {
    id: "academia",
    title: uiText("Academia da Banda"),
    subtitle: uiText("Na Academia a banda cresce — mentorias e formação ao vivo."),
    bullets: [
      uiText("Sessões 1:1, Grupo e Masterclass"),
      uiText("Mentores verificados da comunidade"),
      uiText("Inscrição com regras de tempo (+10% tardia)"),
      uiText("Avaliações e feedback pós-sessão"),
    ],
    icon: <GraduationCap className="h-10 w-10" />,
  },
  {
    id: "kumbu",
    title: uiText("Kumbu — Economia da Participação"),
    subtitle: uiText("Quem participa, ganha. Quem cria, monetiza."),
    bullets: [
      uiText("Moeda virtual Kumbu por interações"),
      uiText("Níveis: Bronze → Prata → Ouro → KOTA"),
      uiText("Conversão para dinheiro real"),
      uiText("Ranking semanal da comunidade"),
    ],
    icon: <Coins className="h-10 w-10" />,
  },
  {
    id: "advertising",
    title: uiText("Publicidade Local"),
    subtitle: uiText("Negócios locais a alcançar a banda certa."),
    bullets: [
      uiText("Perfis de negócio verificados"),
      uiText("Anúncios patrocinados no feed"),
      uiText("Segmentação por cidade e bairro"),
      uiText("Dashboard de métricas em tempo real"),
    ],
    icon: <Megaphone className="h-10 w-10" />,
  },
  {
    id: "i18n",
    title: uiText("Multilingue & Multicultural"),
    subtitle: uiText("10 línguas disponíveis na aplicação."),
    bullets: [
      uiText("Português: Formal ou Urbano"),
      uiText("Lingala, Yoruba, Shona e Zulu"),
      uiText("Inglês, Francês, Swahili, Amárico, Árabe"),
      uiText("Escolha de idioma nas definições; tom disponível em português"),
    ],
    icon: <Globe className="h-10 w-10" />,
  },
  {
    id: "moderation",
    title: uiText("Segurança & Moderação"),
    subtitle: uiText("Uma comunidade segura é uma comunidade forte."),
    bullets: [
      uiText("Denúncia de conteúdo por categorias"),
      uiText("Sistema de strikes com transparência"),
      uiText("Painel de apelações para utilizadores"),
      uiText("Moderação com IA e revisão humana"),
    ],
    icon: <Shield className="h-10 w-10" />,
  },
  {
    id: "closing",
    title: uiText("O mambo começa na banda."),
    subtitle: uiText("yamilook — A vida como ela é."),
    visual: "closing",
  },
];

/* ────────────────────── Presentation component ────────────────────── */

export default function Presentation() {
  const locale = useUiLocale();
  const SLIDES = getSlides();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const total = SLIDES.length;

  const goTo = useCallback(
    (idx: number) => setCurrent(Math.max(0, Math.min(idx, total - 1))),
    [total]
  );
  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          navigate(-1);
        }
      }
      if (e.key === "f" || e.key === "F5") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const slide = SLIDES[current];

  return (
    <div className="fixed inset-0 bg-[#111111] text-white flex flex-col select-none">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => navigate(-1)}
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-white/50 font-mono">
            {current + 1} / {total}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => navigate(`/apresentacao/pdf?lang=${encodeURIComponent(locale)}`)}
            title={uiText("Exportar PDF")}
          >
            <FileDown className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </Button>
      </header>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden" onClick={next}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 md:px-16"
          >
            {/* Visual: logo */}
            {slide.visual === "logo" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="mb-8"
              >
                <YamilookLogo size="xl" showTagline={false} animate />
              </motion.div>
            )}

            {/* Visual: closing */}
            {slide.visual === "closing" && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <YamilookLogo size="lg" showTagline={false} animate={false} />
              </motion.div>
            )}

            {/* Icon */}
            {slide.icon && !slide.visual && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="mb-6 p-4 rounded-2xl bg-primary/20 text-primary"
              >
                {slide.icon}
              </motion.div>
            )}

            {/* Title */}
            <motion.h1
              className={cn(
                "font-bold text-center leading-tight text-white",
                slide.visual === "logo"
                  ? "text-4xl md:text-6xl"
                  : "text-2xl md:text-4xl"
              )}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle */}
            {slide.subtitle && (
              <motion.p
                className={cn(
                  "mt-3 text-center max-w-xl",
                  slide.visual
                    ? "text-lg md:text-xl text-white/70"
                    : "text-base md:text-lg text-white/60"
                )}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                {slide.subtitle}
              </motion.p>
            )}

            {/* Bullets */}
            {slide.bullets && (
              <motion.ul
                className="mt-8 space-y-3 max-w-lg w-full"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } },
                }}
              >
                {slide.bullets.map((b, i) => (
                  <motion.li
                    key={i}
                    className="flex items-start gap-3 text-sm md:text-base text-white/80"
                    variants={{
                      hidden: { opacity: 0, x: 20 },
                      visible: { opacity: 1, x: 0 },
                    }}
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {b}
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <footer className="flex items-center justify-between px-4 py-3 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          disabled={current === 0}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Progress dots */}
        <div className="flex gap-1.5 items-center overflow-hidden max-w-[60vw]">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                goTo(i);
              }}
              className={cn(
                "rounded-full transition-all duration-300",
                i === current
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          disabled={current === total - 1}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </footer>
    </div>
  );
}
