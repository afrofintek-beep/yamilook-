import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, Users, Coins, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACADEMIA_COPY } from '../copy';

export interface SessionCardProps {
  id: string;
  title: string;
  mentorName: string;
  mentorAvatar?: string;
  date: string;
  time: string;
  format?: string;
  scheduledAt?: string;
  spots: number;
  spotsLeft: number;
  isPremium: boolean;
  isLive?: boolean;
  status?: string;
  priceCoins?: number;
  onPress?: () => void;
}

export function SessionCard({
  title,
  mentorName,
  mentorAvatar,
  date,
  time,
  format: sessionFormat,
  scheduledAt,
  spots,
  spotsLeft,
  isPremium,
  isLive,
  status,
  priceCoins,
  onPress,
}: SessionCardProps) {
  // 'completed' (sessão dada) e 'cancelled' também são estados terminais —
  // não devem aparecer como reserváveis.
  const isEnded = status === 'ended' || status === 'completed' || status === 'cancelled';

  // Registration deadline logic
  const now = new Date();
  const startTime = scheduledAt ? new Date(scheduledAt) : null;
  const fiveMinBefore = startTime ? new Date(startTime.getTime() - 5 * 60 * 1000) : null;
  const isLateRegistration = !isEnded && !isLive && startTime && fiveMinBefore && now >= fiveMinBefore && now < startTime && isPremium;
  const isRegistrationClosed = !isEnded && !isLive && startTime && now >= startTime;

  const spotsPercentage = spots > 0 ? ((spots - spotsLeft) / spots) * 100 : 0;
  const isAlmostFull = spotsLeft > 0 && spotsLeft <= 3;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={`border-border/30 bg-card cursor-pointer transition-all duration-300 overflow-hidden ${
          isLive ? 'border-destructive/30 shadow-[0_0_24px_rgba(239,68,68,0.08)]' : 'hover:border-border/50'
        } ${isEnded ? 'opacity-60' : ''}`}
        onClick={onPress}
      >
        <CardContent className="p-4 space-y-3">
          {/* Top row: title + badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="text-sm font-semibold text-foreground leading-tight">{title}</h3>
              {/* Mentor */}
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={mentorAvatar} />
                  <AvatarFallback className="text-[9px] bg-secondary text-secondary-foreground">{mentorName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-[11px] text-muted-foreground">{mentorName}</span>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {isLive && (
                <Badge className="bg-destructive/15 text-destructive text-[10px] px-2 py-0.5 rounded-full gap-1 border-0">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                  </span>
                  AO VIVO
                </Badge>
              )}
              {isPremium ? (
                <Badge className="bg-primary/15 text-primary text-[10px] px-2 py-0.5 rounded-full border-0 gap-1">
                  <Crown className="h-2.5 w-2.5" />
                  Premium
                </Badge>
              ) : (
                <Badge className="bg-success/15 text-success text-[10px] px-2 py-0.5 rounded-full border-0">
                  Gratuita
                </Badge>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            {sessionFormat && (
              <span className="text-[10px] text-muted-foreground bg-secondary rounded-md px-2 py-0.5 capitalize font-medium">
                {sessionFormat}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />{date}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />{time}
            </span>
            {isPremium && priceCoins && priceCoins > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                <Coins className="h-3 w-3" />{priceCoins}
              </span>
            )}
          </div>

          {/* Spots progress */}
          {!isEnded && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {spotsLeft}/{spots} vagas
                </span>
                {isAlmostFull && (
                  <span className="text-[10px] text-primary font-medium animate-pulse">
                    Quase cheio!
                  </span>
                )}
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isAlmostFull ? 'bg-primary' : 'bg-primary/60'
                  }`}
                  style={{ width: `${spotsPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* CTA */}
          {isEnded ? (
            <p className="text-[11px] text-muted-foreground text-center py-1">{status === 'cancelled' ? 'Sessão cancelada' : ACADEMIA_COPY.sessionEndedInfo}</p>
          ) : isRegistrationClosed ? (
            <Button size="sm" variant="secondary" className="w-full rounded-full text-xs h-9" disabled>
              {ACADEMIA_COPY.registrationClosed}
            </Button>
          ) : (
            <>
              {isLateRegistration && (
                <p className="text-[10px] text-primary text-center">{ACADEMIA_COPY.lateRegistration}</p>
              )}
              <Button
                size="sm"
                variant={isLive ? 'destructive' : 'default'}
                className="w-full rounded-full text-xs h-9"
                onClick={(e) => { e.stopPropagation(); onPress?.(); }}
              >
                {isLive ? ACADEMIA_COPY.enter : ACADEMIA_COPY.reserve}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
