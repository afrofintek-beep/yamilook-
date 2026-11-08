import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Radio, Users, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SpaceConfig } from '../copy';
import { MOKUBICO_COPY } from '../copy';

// Cover images
import quintalCover from '@/assets/spaces/quintal-cover.jpg';
import salaCover from '@/assets/spaces/sala-cover.jpg';
import cozinhaCover from '@/assets/spaces/cozinha-cover.jpg';
import quartoCover from '@/assets/spaces/quarto-cover.jpg';

const COVERS: Record<string, string> = {
  quintal: quintalCover,
  sala: salaCover,
  cozinha: cozinhaCover,
  quarto: quartoCover,
};

/* Unique accent colors per space */
const SPACE_ACCENTS: Record<string, { gradient: string; glow: string; badge: string }> = {
  quintal: {
    gradient: 'from-amber-600/90 via-amber-800/60 to-black/90',
    glow: 'shadow-[0_0_40px_rgba(212,175,55,0.15)]',
    badge: 'bg-primary/20 text-primary',
  },
  sala: {
    gradient: 'from-blue-600/80 via-blue-900/60 to-black/90',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.12)]',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  cozinha: {
    gradient: 'from-rose-600/80 via-rose-900/60 to-black/90',
    glow: 'shadow-[0_0_40px_rgba(244,63,94,0.12)]',
    badge: 'bg-rose-500/20 text-rose-400',
  },
  quarto: {
    gradient: 'from-violet-600/80 via-violet-900/60 to-black/90',
    glow: 'shadow-[0_0_40px_rgba(139,92,246,0.12)]',
    badge: 'bg-violet-500/20 text-violet-400',
  },
};

interface SpaceCardProps {
  space: SpaceConfig;
  isLive?: boolean;
  activeCount?: number;
  index?: number;
}

export function SpaceCard({ space, isLive = false, activeCount = 0, index = 0 }: SpaceCardProps) {
  useUiLocale();
  const navigate = useNavigate();
  const cover = COVERS[space.key];
  const accent = SPACE_ACCENTS[space.key] ?? SPACE_ACCENTS.quintal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative overflow-hidden rounded-2xl cursor-pointer group active:scale-[0.97] transition-transform duration-200 ${accent.glow}`}
      style={{ aspectRatio: '2/1' }}
      onClick={() => navigate(space.route)}
    >
      {/* Background image */}
      <img
        src={cover}
        alt={space.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />

      {/* Gradient overlay with space-specific color */}
      <div className={`absolute inset-0 bg-gradient-to-t ${accent.gradient}`} />
      
      {/* Subtle inner border */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />

      {/* Live badge - pulsing */}
      {isLive && (
        <motion.div
          className="absolute top-3 left-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Badge className="bg-destructive text-destructive-foreground text-[10px] px-2.5 py-0.5 rounded-full gap-1.5 border-0 shadow-lg shadow-destructive/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive-foreground" />
            </span>
            {MOKUBICO_COPY.liveBadge}
          </Badge>
        </motion.div>
      )}

      {/* Active listeners pill */}
      {activeCount > 0 && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-black/50 text-white text-[10px] px-2.5 py-0.5 rounded-full border-0 backdrop-blur-md gap-1">
            <Users className="h-3 w-3" />
            {activeCount}
          </Badge>
        </div>
      )}

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl drop-shadow-lg">{space.emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">{space.title}</h3>
            <p className="text-[11px] text-white/70 leading-snug truncate">{space.headline}</p>
          </div>
          <div className="shrink-0 h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
            {space.key === 'quarto' ? (
              <Lock className="h-3.5 w-3.5 text-white/80" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
            )}
          </div>
        </div>
        
        {/* Access tag */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full backdrop-blur-sm ${accent.badge}`}>
            {space.access}
          </span>
          {isLive && (
            <span className="text-[10px] text-white/50">{uiText("Roda ativa agora")}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
