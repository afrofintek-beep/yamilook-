import { uiText, useUiLocale } from '@/i18n/ui-copy';
import KosololaLogo from '@/components/brand/KosololaLogo';
import DocumentControls from "@/components/DocumentControls";
import { useLocation } from "react-router-dom";
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

const getSlides = (): Slide[] => [
  { id: "cover", title: "yamilook", subtitle: uiText("A vida como ela é."), visual: "logo" },
  { id: "mission", title: uiText("A nossa missão"), subtitle: uiText("Criar a primeira super-app social africana — feita por angolanos, para a banda toda."), bullets: [uiText("Comunidade local em primeiro lugar"), uiText("Cultura africana como identidade, não decoração"), uiText("Privacidade e respeito como valores fundamentais")], icon: <Heart className="h-12 w-12" /> },
  { id: "feed", title: uiText("Muxi — Feed Social"), subtitle: uiText("Partilha momentos, ideias e vibes com a tua banda."), bullets: [uiText("Publicações com fotos, vídeos e texto"), uiText("Sistema de Reações Africanas exclusivo"), uiText("Tópicos de descoberta e trending"), uiText("Stories que desaparecem em 24h")], icon: <Camera className="h-12 w-12" /> },
  { id: "reactions", title: uiText("Reações Africanas"), subtitle: uiText("Emoções com significado cultural, não apenas emojis genéricos."), visual: "reactions", bullets: [uiText("🪘 Djembe — Celebração"), uiText("❤️ Sankofa Love — Amor profundo"), uiText("🤝 Ubuntu — Solidariedade"), uiText("⚡ Shango — Poder e força"), uiText("😤 Eish — Desconforto")] },
  { id: "chat", title: uiText("KOSOLOLA — Conversas"), subtitle: uiText("Conversas privadas e em grupo, com todo o mambo."), bullets: [uiText("Mensagens de texto, áudio e vídeo"), uiText("Grupos com administração avançada"), uiText("Mensagens que desaparecem"), uiText("Reações, respostas e encaminhamento"), uiText("GIFs, stickers e formatação rica")], icon: <KosololaLogo className="h-12 w-12" /> },
  { id: "calls", title: uiText("Chamadas"), subtitle: uiText("Voz e vídeo de alta qualidade com a tua banda."), bullets: [uiText("Chamadas individuais e em grupo"), uiText("Vídeo com fundos virtuais"), uiText("Gravação de chamadas"), uiText("Sala de espera e controlo de anfitrião"), uiText("Salas breakout para grupos grandes")], icon: <Phone className="h-12 w-12" /> },
  { id: "live", title: uiText("Live — Transmissões ao Vivo"), subtitle: uiText("Vai ao vivo e conecta-te com a tua comunidade em tempo real."), bullets: [uiText("Streaming de áudio e vídeo"), uiText("Chat ao vivo e reações"), uiText("Gestão de participantes"), uiText("Integração com Palco e Mokubico")], icon: <Radio className="h-12 w-12" /> },
  { id: "mokubico", title: "MOKUBICO", subtitle: uiText("Onde a tua banda vive — espaços de convívio por áudio."), visual: "mokubico", bullets: [uiText("🌴 Quintal — Conversas abertas para todos"), uiText("🛋️ Sala — Rodas íntimas entre kambas"), uiText("🍳 Cozinha das Sis — Espaço seguro feminino"), uiText("🔒 Quarto — Privacidade total a dois")] },
  { id: "ritmos", title: uiText("Ritmos"), subtitle: uiText("Vídeos curtos com o ritmo de Angola."), bullets: [uiText("Criação rápida de vídeos curtos"), uiText("Efeitos e filtros africanos"), uiText("Feed vertical tipo TikTok"), uiText("Partilha direta para o feed e stories")], icon: <Music className="h-12 w-12" /> },
  { id: "palco", title: uiText("Palco"), subtitle: uiText("O teu espaço de criação e performance ao vivo."), bullets: [uiText("Criação de palcos temáticos"), uiText("Rodas de conversa moderadas"), uiText("Sistema de Vozes para co-criação"), uiText("Dashboard de gestão para criadores")], icon: <Zap className="h-12 w-12" /> },
  { id: "academia", title: uiText("Academia da Banda"), subtitle: uiText("Na Academia a banda cresce — mentorias e formação ao vivo."), bullets: [uiText("Sessões 1:1, Grupo e Masterclass"), uiText("Mentores verificados da comunidade"), uiText("Inscrição com regras de tempo (+10% tardia)"), uiText("Avaliações e feedback pós-sessão")], icon: <GraduationCap className="h-12 w-12" /> },
  { id: "kumbu", title: uiText("Kumbu — Economia da Participação"), subtitle: uiText("Quem participa, ganha. Quem cria, monetiza."), bullets: [uiText("Moeda virtual Kumbu por interações"), uiText("Níveis: Bronze → Prata → Ouro → KOTA"), uiText("Conversão para dinheiro real"), uiText("Ranking semanal da comunidade")], icon: <Coins className="h-12 w-12" /> },
  { id: "advertising", title: uiText("Publicidade Local"), subtitle: uiText("Negócios locais a alcançar a banda certa."), bullets: [uiText("Perfis de negócio verificados"), uiText("Anúncios patrocinados no feed"), uiText("Segmentação por cidade e bairro"), uiText("Dashboard de métricas em tempo real")], icon: <Megaphone className="h-12 w-12" /> },
  { id: "i18n", title: uiText("Multilingue & Multicultural"), subtitle: uiText("10 línguas disponíveis na aplicação."), bullets: [uiText("Português: Formal ou Urbano"), uiText("Lingala, Yoruba, Shona e Zulu"), uiText("Inglês, Francês, Swahili, Amárico, Árabe"), uiText("Escolha de idioma nas definições; tom disponível em português")], icon: <Globe className="h-12 w-12" /> },
  { id: "moderation", title: uiText("Segurança & Moderação"), subtitle: uiText("Uma comunidade segura é uma comunidade forte."), bullets: [uiText("Denúncia de conteúdo por categorias"), uiText("Sistema de strikes com transparência"), uiText("Painel de apelações para utilizadores"), uiText("Moderação com IA e revisão humana")], icon: <Shield className="h-12 w-12" /> },
  { id: "closing", title: uiText("O mambo começa na banda."), subtitle: uiText("yamilook — A vida como ela é."), visual: "closing" },
];

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  const isCover = slide.visual === "logo";
  const isClosing = slide.visual === "closing";

  return (
    <div className="print-slide bg-[#111111] text-white flex flex-col items-center justify-center px-16 py-12 relative">
      {/* Slide number */}
      <span className="absolute top-4 right-6 text-xs text-white/30 font-mono">
        {index + 1} / {16}
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
  useUiLocale();
  const SLIDES = getSlides();
  const location = useLocation();

  return (
    <>
      <DocumentControls title={uiText("Apresentação da Yamilook")} autoPrint={location.pathname.endsWith("/pdf") && new URLSearchParams(location.search).get("print") !== "0"} />
      <style>{`
        .print-slide { position: relative; padding-block: 2rem; }
        .print-slide code { direction: ltr; unicode-bidi: isolate; }
        @media screen {
          .print-slide {
            width: 100%;
            min-height: 56.25vw;
            page-break-after: always;
            break-after: page;
          }
        }
        @media print {
          @page {
            size: A4 landscape;
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
            width: 297mm;
            min-height: 210mm;
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
