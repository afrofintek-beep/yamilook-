import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { Crown, Medal } from 'lucide-react';

interface Entry {
  position: number;
  displayName: string;
  level: string;
}

interface Props {
  entries: Entry[];
  weekLabel?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  Bronze: 'text-amber-600 bg-amber-900/15',
  Prata: 'text-slate-300 bg-slate-400/10',
  Ouro: 'text-[#C9A23F] bg-[#C9A23F]/10',
  KOTA: 'text-primary bg-primary/10',
};

const positionStyle = (pos: number) => {
  if (pos === 1) return { icon: Crown, color: 'text-[#C9A23F]', bg: 'bg-[#C9A23F]/8 border-[#C9A23F]/15' };
  if (pos === 2) return { icon: Medal, color: 'text-slate-300', bg: 'bg-slate-400/5 border-border/20' };
  if (pos === 3) return { icon: Medal, color: 'text-amber-700', bg: 'bg-amber-900/5 border-border/20' };
  return { icon: null, color: 'text-muted-foreground/50', bg: 'border-transparent' };
};

export default function Top10Card({ entries, weekLabel }: Props) {
  useUiLocale();
  if (!entries.length) {
    return (
      <div className="rounded-2xl bg-card border border-border/30 p-6 text-center">
        <p className="text-sm text-muted-foreground/50">{uiText("Sem resultados para esta semana.")}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-2xl bg-card border border-border/30 overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-bold text-foreground">{uiText("Top 10 do Bairro")}</h3>
        {weekLabel && (
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">{weekLabel}</p>
        )}
      </div>
      <div className="px-3 pb-4 space-y-1">
        {entries.map((e, i) => {
          const style = positionStyle(e.position);
          const levelColor = LEVEL_COLORS[e.level] || 'text-muted-foreground bg-muted/60';
          const Icon = style.icon;

          return (
            <motion.div
              key={e.position}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${style.bg} transition-colors`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
            >
              <div className="w-6 flex justify-center">
                {Icon ? (
                  <Icon className={`w-4 h-4 ${style.color}`} strokeWidth={1.8} />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground/40 tabular-nums">
                    {e.position}
                  </span>
                )}
              </div>
              <span className="flex-1 text-[13px] font-medium text-foreground/85 truncate">
                {e.displayName}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${levelColor}`}>
                {e.level}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
