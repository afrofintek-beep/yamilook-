import { motion } from 'framer-motion';
import { CheckCircle2, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProfileHeaderProps {
  avatarUrl: string | null;
  name: string;
  subtitle?: string | null;
  username: string;
  bandaName?: string | null;
  isVerified?: boolean;
  role?: 'founder' | 'verified_creator' | 'default';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  onAvatarClick?: () => void;
}

export function ProfileHeader({
  avatarUrl,
  name,
  subtitle,
  username,
  bandaName,
  isVerified = false,
  role = 'default',
  isOnline = false,
  showOnlineStatus = true,
  onAvatarClick,
}: ProfileHeaderProps) {
  const getRingStyle = () => {
    switch (role) {
      case 'founder':
        return 'ring-[#C9A23F] ring-[3px]';
      case 'verified_creator':
        return 'ring-primary/50 ring-2';
      default:
        return 'ring-border/40 ring-2';
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center pt-2 pb-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* Avatar */}
      <button
        onClick={onAvatarClick}
        className="relative group mb-4"
        aria-label="Ver foto de perfil"
      >
        <Avatar
          className={`w-24 h-24 border-[3px] border-background shadow-xl ${getRingStyle()} transition-all duration-300`}
        >
          <AvatarImage src={avatarUrl || ''} imageVariantSize={320} className="object-cover" />
          <AvatarFallback className="text-3xl font-bold bg-secondary text-foreground">
            {name[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {showOnlineStatus && isOnline && (
          <motion.span
            className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-[2.5px] border-background"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
          />
        )}
      </button>

      {/* Name with verified badge */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {name}
        </h1>
        {isVerified && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <CheckCircle2 className="w-4.5 h-4.5 text-[#C9A23F] fill-[#C9A23F]/20" />
          </motion.div>
        )}
      </div>

      {/* Username */}
      <p className="text-xs text-muted-foreground/60 mb-1.5">@{username}</p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[13px] text-muted-foreground/80 font-medium text-center max-w-[260px] leading-snug">
          {subtitle}
        </p>
      )}

      {/* Banda */}
      {bandaName && (
        <motion.div
          className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-muted/60 border border-border/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <MapPin className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-[11px] font-medium text-muted-foreground/70">{bandaName}</span>
        </motion.div>
      )}
    </motion.div>
  );
}
