import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface MentorCardProps {
  id: string;
  name: string;
  avatar?: string;
  specialty: string;
  rating: number;
  sessionCount: number;
  isVerified?: boolean;
  onPress?: () => void;
}

export function MentorCard({ name, avatar, specialty, rating, sessionCount, isVerified, onPress }: MentorCardProps) {
  useUiLocale();
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className="min-w-[150px] shrink-0"
    >
      <Card
        className="border-border/30 bg-card cursor-pointer hover:border-primary/20 transition-colors duration-300 overflow-hidden"
        onClick={onPress}
      >
        <CardContent className="p-4 flex flex-col items-center text-center gap-2.5">
          {/* Avatar with ring */}
          <div className="relative">
            <div className="rounded-full p-[2px] bg-gradient-to-br from-primary/60 to-primary/20">
              <Avatar className="h-16 w-16 border-2 border-card">
                <AvatarImage src={avatar} />
                <AvatarFallback className="bg-secondary text-foreground text-lg font-semibold">
                  {name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            {isVerified && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-0.5">
                <CheckCircle2 className="h-4 w-4 text-primary fill-primary/20" />
              </div>
            )}
          </div>

          {/* Name */}
          <span className="text-xs font-semibold text-foreground leading-tight">{name}</span>

          {/* Specialty badge */}
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full border-border/30">
            {specialty}
          </Badge>

          {/* Stats row */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-primary text-primary" />
              {rating.toFixed(1)}
            </span>
            <span className="w-px h-3 bg-border" />
            <span>{uiText("{{value1}} sessões", { value1: (sessionCount) ?? "" })}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
