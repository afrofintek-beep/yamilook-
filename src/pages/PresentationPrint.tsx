import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import YamilookLogo from "@/components/brand/YamilookLogo";
import {
  MessageCircle, Phone, Radio, Music, GraduationCap,
  Coins, Shield, Globe, Megaphone, Camera, Heart, Zap,
} from "lucide-react";

interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  icon?: React.ReactNode;
  visual?: "logo" | "reactions" | "mokubico" | "closing";
}

const SLIDES: Slide[] = [
  { id: "cover", title: "yamilook", subtitle: "A vida como ela é.", visual: "logo" },
  { id: "mission", title: "A nossa missão", subtitle: "Criar a primeira super-app social africana — feita por angolanos, para a banda toda.", bullets: ["Comunidade local em primeiro lugar", "Cultura africana como identidade, não decoração", "Privacidade e respeito como valores fundamentais"], icon: <Heart className="h-12 w-12" /> },
  { id: "feed", title: "Muxi — Feed Social", subtitle: "Partilha momentos, ideias e vibes com a tua banda.", bullets: ["Publicações com fotos, vídeos e texto", "Sistema de Reações Africanas exclusivo", "Tópicos de descoberta e trending", "Stories que desaparecem em 24h"], icon: <Camera className="h-12 w-12" /> },
  { id: "reactions", title: "Reações Africanas", subtitle: "Emoções com significado cultural, não apenas emojis genéricos.", visual: "reactions", bullets: ["🪘 Djembe — Celebração", "❤️ Sankofa Love — Amor profundo", "🤝 Ubuntu — Solidariedade", "⚡ Shango — Poder e força", "😤 Eish — Desconforto"] },
  { id: "chat", title: "KOSOLOLA — Conversas", subtitle: "Conversas privadas e em grupo, com todo o mambo.", bullets: ["Mensagens de texto, áudio e vídeo", "Grupos com administração avançada", "Mensagens que desaparecem", "Reações, respostas e encaminhamento", "GIFs, stickers e formatação rica"], icon: <MessageCircle className="h-12 w-12" /> },
  { id: "calls", title: "Chamadas", subtitle: "Voz e vídeo de alta qualidade com a tua banda.", bullets: ["Chamadas individuais e em grupo", "Vídeo com fundos virtuais", "Gravação de chamadas", "Sala de espera e controlo de anfitrião", "Salas breakout para grupos grandes"], icon: <Phone className="h-12 w-12" /> },
  { id: "live", title: "Live — Transmissões ao Vivo", subtitle: "Vai ao vivo e conecta-te com a tua comunidade em tempo real.", bullets: ["Streaming de áudio e vídeo", "Chat ao vivo e reações", "Gestão de participantes", "Integração com Palco e Mokubico"], icon: <Radio className="h-12 w-12" /> },
  { id: "mokubico", title: "MOKUBICO", subtitle: "Onde a tua banda vive — espaços de convívio por áudio.", visual: "mokubico", bullets: ["🌴 Quintal — Conversas abertas para todos", "🛋️ Sala — Rodas íntimas entre kambas", "🍳 Cozinha das Sis — Espaço seguro feminino", "🔒 Quarto — Privacidade total a dois"] },
  { id: "ritmos", title: "Ritmos", subtitle: "Vídeos curtos com o ritmo de Angola.", bullets: ["Criação rápida de vídeos curtos", "Efeitos e filtros africanos", "Feed vertical tipo TikTok", "Partilha direta para o feed e stories"], icon: <Music className="h-12 w-12" /> },
  { id: "palco", title: "Palco", subtitle: "O teu espaço de criação e performance ao vivo.", bullets: ["Criação de palcos temáticos", "Rodas de conversa moderadas", "Sistema de Vozes para co-criação", "Dashboard de gestão para criadores"], icon: <Zap className="h-12 w-12" /> },
  { id: "academia", title: "Academia da Banda", subtitle: "Na Academia a banda cresce — mentorias e formação ao vivo.", bullets: ["Sessões 1:1, Grupo e Masterclass", "Mentores verificados da comunidade", "Inscrição com regras de tempo (+10% tardia)", "Avaliações e feedback pós-sessão"], icon: <GraduationCap className="h-12 w-12" /> },
  { id: "kumbu", title: "Kumbu — Economia da Participação", subtitle: "Quem participa, ganha. Quem cria, monetiza.", bullets: ["Moeda virtual Kumbu por interações", "Níveis: Bronze → Prata → Ouro → KOTA", "Conversão para dinheiro real", "Ranking semanal da comunidade"], icon: <Coins className="h-12 w-12" /> },
  { id: "advertising", title: "Publicidade Local", subtitle: "Negócios locais a alcançar a banda certa.", bullets: ["Perfis de negócio verificados", "Anúncios patrocinados no feed", "Segmentação por cidade e bairro", "Dashboard de métricas em tempo real"], icon: <Megaphone className="h-12 w-12" /> },
  { id: "i18n", title: "Multilingue & Multicultural", subtitle: "12 idiomas, incluindo 5 línguas angolanas nativas.", bullets: ["Português (formal) e Yamilook da Banda (urbano)", "Kimbundu, Umbundu, Kikongo, Tchokwe, Lingala", "Inglês, Francês, Swahili, Amárico, Árabe", "Seleção de tom no primeiro ecrã"], icon: <Globe className="h-12 w-12" /> },
  { id: "moderation", title: "Segurança & Moderação", subtitle: "Uma comunidade segura é uma comunidade forte.", bullets: ["Denúncia de conteúdo por categorias", "Sistema de strikes com transparência", "Painel de apelações para utilizadores", "Moderação com IA e revisão humana"], icon: <Shield className="h-12 w-12" /> },
  { id: "closing", title: "O mambo começa na banda.", subtitle: "yamilook — A vida como ela é.", visual: "closing" },
];

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  const isCover = slide.visual === "logo";
  const isClosing = slide.visual === "closing";

  return (
    <div className="print-slide bg-[#111111] text-white flex flex-col items-center justify-center px-16 py-12 relative">
      {/* Slide number */}
      <span className="absolute top-4 right-6 text-xs text-white/30 font-mono">
        {index + 1} / {SLIDES.length}
      </span>

      {/* Logo for cover/closing */}
      {(isCover || isClosing) && (
        <div className="mb-6">
          <YamilookLogo size={isCover ? "xl" : "lg"} showTagline={false} animate={false} />
        </div>
      )}

      {/* Icon */}
      {slide.icon && !slide.visual && (
        <div className="mb-6 p-4 rounded-2xl bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]">
          {slide.icon}
        </div>
      )}

      {/* Title */}
      <h2 className={`font-bold text-center leading-tight ${isCover ? "text-5xl" : "text-3xl"}`}>
        {slide.title}
      </h2>

      {/* Subtitle */}
      {slide.subtitle && (
        <p className={`mt-3 text-center max-w-xl ${slide.visual ? "text-xl text-white/70" : "text-lg text-white/60"}`}>
          {slide.subtitle}
        </p>
      )}

      {/* Bullets */}
      {slide.bullets && (
        <ul className="mt-8 space-y-3 max-w-lg w-full">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-white/80">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-[hsl(var(--primary))] shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PresentationPrint() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-trigger print after a short delay for rendering
    const timer = setTimeout(() => {
      window.print();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // After print, listen for afterprint to go back
  useEffect(() => {
    const handler = () => navigate(-1);
    window.addEventListener("afterprint", handler);
    return () => window.removeEventListener("afterprint", handler);
  }, [navigate]);

  return (
    <>
      <style>{`
        @media screen {
          .print-slide {
            width: 100%;
            aspect-ratio: 16 / 9;
            page-break-after: always;
            break-after: page;
          }
        }
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #111111 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, header, footer, .bottom-nav {
            display: none !important;
          }
          .print-slide {
            width: 100vw;
            height: 100vh;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-slide:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
      <div className="print-container">
        {SLIDES.map((slide, i) => (
          <SlideCard key={slide.id} slide={slide} index={i} />
        ))}
      </div>
    </>
  );
}
