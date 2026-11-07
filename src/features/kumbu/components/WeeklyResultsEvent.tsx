import { uiText, useUiLocale, uiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface Props {
  weekStart: string;
  weekEnd: string;
}

export default function WeeklyResultsEvent({ weekStart, weekEnd }: Props) {
  useUiLocale();
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(uiLocale(), { day: 'numeric', month: 'short' });

  return (
    <motion.div
      className="flex items-center gap-3 p-4 rounded-xl bg-[#C9A23F]/5 border border-[#C9A23F]/15"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="w-9 h-9 rounded-lg bg-[#C9A23F]/10 flex items-center justify-center flex-shrink-0">
        <Trophy className="h-4 w-4 text-[#C9A23F]" strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-foreground">{uiText("Resultados semanais")}</p>
        <p className="text-[11px] text-muted-foreground/50">
          {fmt(weekStart)} – {fmt(weekEnd)}
        </p>
      </div>
    </motion.div>
  );
}
