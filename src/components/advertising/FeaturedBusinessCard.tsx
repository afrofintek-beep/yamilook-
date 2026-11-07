import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MapPin,
  Phone,
  ChevronRight,
  BadgeCheck,
  Sparkles
} from 'lucide-react';
import { useAdvertising, Advertisement, BusinessProfile, LocationMarket } from '@/hooks/useAdvertising';
import { resolveAdAction } from '@/lib/ad-action';
import { toast } from 'sonner';

interface FeaturedBusinessCardProps {
  ad: Advertisement & { business?: BusinessProfile };
  userMarket?: LocationMarket;
  compact?: boolean;
  onAction?: () => void;
}

export function FeaturedBusinessCard({ ad, userMarket, compact = false, onAction }: FeaturedBusinessCardProps) {
  useUiLocale();
  const { recordImpression, recordClick } = useAdvertising();
  const [hasRecordedImpression, setHasRecordedImpression] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Record impression when card becomes visible (privacy-preserving)
  useEffect(() => {
    if (hasRecordedImpression) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          recordImpression(ad.id, userMarket);
          setHasRecordedImpression(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [ad.id, hasRecordedImpression, recordImpression, userMarket]);

  const handleClick = () => {
    recordClick(ad.id, 'view_profile');
    const action = resolveAdAction(ad);
    if (action.kind === 'none') {
      toast.info(uiText("Este negócio ainda não tem contacto disponível."));
    } else {
      window.open(action.href!, '_blank', 'noopener,noreferrer');
    }
    onAction?.();
  };

  const business = ad.business;

  if (compact) {
    return (
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card
          className="p-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleClick}
        >
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-primary/20">
              <AvatarImage src={business?.logo_url || business?.cover_image_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {business?.business_name?.charAt(0) || 'N'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm truncate">
                  {business?.business_name || uiText("Negócio local")}
                </span>
                {business?.is_verified && (
                  <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{ad.target_city}{ad.target_neighborhood ? ` - ${ad.target_neighborhood}` : ''}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        onClick={handleClick}
      >
        {/* Cover image */}
        {business?.cover_image_url ? (
          <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
            <img
              src={business.cover_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
            <Badge
              className="absolute top-2 right-2 text-[10px] bg-primary/10 text-primary border-0"
              variant="secondary"
            >
              <Sparkles className="w-3 h-3 mr-1" />{uiText("Destaque Local")}</Badge>
          </div>
        ) : (
          <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary/30">
              {business?.business_name?.charAt(0) || 'N'}
            </span>
            <Badge
              className="absolute top-2 right-2 text-[10px] bg-primary/10 text-primary border-0"
              variant="secondary"
            >
              <Sparkles className="w-3 h-3 mr-1" />{uiText("Destaque Local")}</Badge>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <Avatar className="w-14 h-14 -mt-10 border-4 border-background shadow-lg">
              <AvatarImage src={business?.logo_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                {business?.business_name?.charAt(0) || 'N'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold truncate">
                  {business?.business_name || uiText("Negócio local")}
                </h3>
                {business?.is_verified && (
                  <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                )}
              </div>
              {business?.business_category && (
                <Badge variant="outline" className="text-xs mt-1">
                  {business.business_category}
                </Badge>
              )}
            </div>
          </div>

          {business?.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {business.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {(ad.target_city || business?.city) && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{ad.target_city || business?.city}{ad.target_neighborhood ? ` - ${ad.target_neighborhood}` : ''}</span>
              </div>
            )}
            {business?.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span>{uiText("Contactar")}</span>
              </div>
            )}
          </div>

          {ad.call_to_action && (
            <Button className="w-full mt-4" size="sm">
              {ad.call_to_action}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
