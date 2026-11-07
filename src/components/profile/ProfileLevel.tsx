import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { Crown, ShieldCheck, User } from 'lucide-react';

interface ProfileLevelProps {
  role: 'founder' | 'verified_creator' | 'default';
}

const levelConfig = {
  founder: {
    icon: Crown,
    get label() { return uiText("Fundador"); },
    sublabel: 'Membro fundador do Yamilook',
    containerClass: 'bg-[#C9A23F]/8 border-[#C9A23F]/20',
    iconClass: 'text-[#C9A23F]',
    textClass: 'text-[#C9A23F]',
    dotClass: 'bg-[#C9A23F]',
  },
  verified_creator: {
    icon: ShieldCheck,
    get label() { return uiText("Criador Verificado"); },
    sublabel: 'Identidade verificada',
    containerClass: 'bg-primary/8 border-primary/20',
    iconClass: 'text-primary',
    textClass: 'text-primary',
    dotClass: 'bg-primary',
  },
  default: {
    icon: User,
    get label() { return uiText("Membro"); },
    sublabel: 'Membro da comunidade',
    containerClass: 'bg-muted/60 border-border/30',
    iconClass: 'text-muted-foreground',
    textClass: 'text-foreground',
    dotClass: 'bg-muted-foreground',
  },
};

export function ProfileLevel({ role }: ProfileLevelProps) {
  useUiLocale();
  const config = levelConfig[role];
  const Icon = config.icon;

  return (
    <motion.div
      className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border ${config.containerClass} mx-auto w-fit`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Icon className={`w-4 h-4 ${config.iconClass}`} strokeWidth={2} />
      <div className="flex flex-col">
        <span className={`text-[11px] font-bold uppercase tracking-wider leading-none ${config.textClass}`}>
          {config.label}
        </span>
        <span className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
          {config.sublabel}
        </span>
      </div>
    </motion.div>
  );
}
