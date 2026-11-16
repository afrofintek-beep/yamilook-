import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Crown, Users, ShieldCheck, Star } from 'lucide-react';

interface ProfileBadge {
  type: 'founder' | 'community' | 'verified' | 'creator' | string;
  label: string;
  to?: string;
}

interface ProfileBadgesProps {
  badges: ProfileBadge[];
}

const badgeConfig: Record<string, { icon: React.ElementType; bgClass: string; textClass: string; borderClass: string }> = {
  founder: {
    icon: Crown,
    bgClass: 'bg-[#C9A23F]/8',
    textClass: 'text-[#C9A23F]',
    borderClass: 'border-[#C9A23F]/20',
  },
  community: {
    icon: Users,
    bgClass: 'bg-primary/8',
    textClass: 'text-primary',
    borderClass: 'border-primary/20',
  },
  verified: {
    icon: ShieldCheck,
    bgClass: 'bg-primary/8',
    textClass: 'text-primary',
    borderClass: 'border-primary/20',
  },
  creator: {
    icon: Star,
    bgClass: 'bg-primary/8',
    textClass: 'text-primary',
    borderClass: 'border-primary/20',
  },
};

export function ProfileBadges({ badges }: ProfileBadgesProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <motion.div
      className="flex flex-wrap justify-center gap-2 px-6 mb-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
    >
      {badges.map((badge, index) => {
        const config = badgeConfig[badge.type] || {
          icon: Star,
          bgClass: 'bg-muted/60',
          textClass: 'text-muted-foreground',
          borderClass: 'border-border/30',
        };
        const Icon = config.icon;

        return (
          <motion.div
            key={badge.type}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${config.bgClass} ${config.textClass} ${config.borderClass}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.08 }}
          >
            {badge.to ? (
              <Link
                to={badge.to}
                className="flex min-h-11 items-center gap-1.5 -mx-3 -my-1.5 px-3 py-1.5 rounded-lg hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                {badge.label}
              </Link>
            ) : (
              <>
                <Icon className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                {badge.label}
              </>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
