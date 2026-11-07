import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Calendar, Users } from 'lucide-react';

interface ProfileContributionsProps {
  sessionsCreated: number;
  sessionsAttended: number;
  isOwner?: boolean;
}

export function ProfileContributions({ sessionsCreated, sessionsAttended, isOwner }: ProfileContributionsProps) {
  useUiLocale();
  if (sessionsCreated === 0 && sessionsAttended === 0) return null;

  const items = [
    {
      icon: GraduationCap,
      label: uiText("Sessões criadas"),
      value: sessionsCreated,
      sublabel: 'Na Academia',
      accent: true,
    },
    {
      icon: BookOpen,
      label: uiText("Sessões frequentadas"),
      value: sessionsAttended,
      sublabel: 'Como participante',
      accent: false,
    },
  ].filter(item => item.value > 0 || isOwner);

  if (items.length === 0) return null;

  return (
    <motion.div
      className="px-4 mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 px-1">{uiText("Academia da Banda")}</h3>
      <div className="flex gap-2.5">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              className={`flex-1 p-4 rounded-xl border ${
                item.accent
                  ? 'bg-primary/5 border-primary/15'
                  : 'bg-card border-border/30'
              }`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 + index * 0.08 }}
            >
              <Icon
                className={`w-5 h-5 mb-2 ${
                  item.accent ? 'text-primary' : 'text-muted-foreground/50'
                }`}
                strokeWidth={1.5}
              />
              <span className="text-2xl font-bold text-foreground block leading-none">
                {item.value}
              </span>
              <span className="text-[10px] text-muted-foreground/60 mt-1 block leading-tight">
                {item.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
