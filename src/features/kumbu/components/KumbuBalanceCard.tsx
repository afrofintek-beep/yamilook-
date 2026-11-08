import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { useKumbuBalance } from '../hooks/useKumbuBalance';
import { Coins, TrendingUp } from 'lucide-react';

const LEVEL_COLORS: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
  Bronze: { ring: 'border-amber-700/30', text: 'text-amber-600', bg: 'bg-amber-900/15', glow: 'from-amber-700/8' },
  Prata: { ring: 'border-slate-400/30', text: 'text-slate-300', bg: 'bg-slate-400/10', glow: 'from-slate-400/8' },
  Ouro: { ring: 'border-[#C9A23F]/40', text: 'text-[#C9A23F]', bg: 'bg-[#C9A23F]/10', glow: 'from-[#C9A23F]/10' },
  KOTA: { ring: 'border-primary/40', text: 'text-primary', bg: 'bg-primary/10', glow: 'from-primary/10' },
};

export default function KumbuBalanceCard() {
  useUiLocale();
  const { available, lifetime, level, progress } = useKumbuBalance();
  const { pct, target } = progress;
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS.Bronze;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl border ${colors.ring} bg-card p-5`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Subtle top glow */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${colors.glow} to-transparent pointer-events-none`} />

      {/* Header row */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
            <Coins className={`w-4 h-4 ${colors.text}`} strokeWidth={1.8} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
            Kumbu
          </span>
        </div>
        <div className={`px-2.5 py-1 rounded-lg ${colors.bg}`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
            {level}
          </span>
        </div>
      </div>

      {/* Balance */}
      <div className="relative mb-5">
        <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-1">{uiText("Saldo disponível")}</p>
        <p className="text-4xl font-bold text-foreground tracking-tight tabular-nums leading-none">
          {available}
        </p>
      </div>

      {/* Lifetime + Progress */}
      <div className="relative space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/50">{uiText("Lifetime")}</span>
          </div>
          <span className="text-xs font-semibold text-foreground/80 tabular-nums">
            {lifetime}
            {target !== Infinity && (
              <span className="text-muted-foreground/40 font-normal"> / {target}</span>
            )}
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-[10px] text-muted-foreground/40 text-right tabular-nums">
          {pct}%
        </p>
      </div>
    </motion.div>
  );
}
