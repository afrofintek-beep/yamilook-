import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { Trophy, GraduationCap, BookOpen, Users, Flame, Star, Heart } from 'lucide-react';

export interface Achievement {
  id: string;
  icon: 'trophy' | 'graduation' | 'book' | 'community' | 'streak' | 'star' | 'heart';
  label: string;
  value: string;
  description?: string;
}

interface ProfileAchievementsProps {
  achievements: Achievement[];
}

const iconMap: Record<string, React.ElementType> = {
  trophy: Trophy,
  graduation: GraduationCap,
  book: BookOpen,
  community: Users,
  streak: Flame,
  star: Star,
  heart: Heart,
};

export function ProfileAchievements({ achievements }: ProfileAchievementsProps) {
  useUiLocale();
  if (!achievements || achievements.length === 0) return null;

  return (
    <motion.div
      className="px-4 mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.3 }}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 px-1">{uiText("Conquistas")}</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {achievements.map((achievement, index) => {
          const Icon = iconMap[achievement.icon] || Trophy;
          return (
            <motion.div
              key={achievement.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.06 }}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-foreground leading-none block">
                  {achievement.value}
                </span>
                <span className="text-[10px] text-muted-foreground/60 leading-tight block mt-0.5 truncate">
                  {achievement.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
