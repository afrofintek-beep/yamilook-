import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  BadgeCheck
} from 'lucide-react';
import { useAdvertising, Advertisement, BusinessProfile, LocationMarket } from '@/hooks/useAdvertising';
import { resolveAdAction } from '@/lib/ad-action';
import { toast } from 'sonner';

interface SponsoredPostCardProps {
  ad: Advertisement & { business?: BusinessProfile };
  userMarket?: LocationMarket;
  onAction?: () => void;
}

export function SponsoredPostCard({ ad, userMarket, onAction }: SponsoredPostCardProps) {
  useUiLocale();
  const { recordImpression, recordClick } = useAdvertising();
  const [hasRecordedImpression, setHasRecordedImpression] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Record impression when card becomes visible (privacy-preserving)
  useEffect(() => {
    if (hasRecordedImpression) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Only pass market-level data, not user GPS
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

  const handleCtaClick = () => {
    recordClick(ad.id, 'cta');
    const action = resolveAdAction(ad);
    if (action.kind === 'none') {
      toast.info(uiText("Este anúncio ainda não tem link nem contacto."));
    } else {
      window.open(action.href!, '_blank', 'noopener,noreferrer');
    }
    onAction?.();
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    recordClick(ad.id, 'like');
    if (!isLiked) {
      toast.success(uiText("Gostou do anúncio!"));
    }
  };

  const handleComment = () => {
    recordClick(ad.id, 'comment');
    toast.info(uiText("Comentários em breve!"));
  };

  const handleShare = async () => {
    recordClick(ad.id, 'share');
    const shareData = {
      title: ad.title || ad.business?.business_name || 'Destaque Local',
      text: ad.description || '',
      url: ad.cta_url || window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      toast.success(uiText("Link copiado!"));
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    recordClick(ad.id, 'save');
    toast.success(isSaved ? 'Removido dos guardados' : 'Guardado!');
  };

  const business = ad.business;

  return (
    <div ref={cardRef}>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        {/* "Destaque Local" badge - non-aggressive */}
        <div className="px-4 pt-3 pb-2">
          <Badge variant="secondary" className="text-[10px] font-normal bg-primary/10 text-primary border-0">{uiText("✨ Destaque Local")}</Badge>
        </div>

        {/* Business header */}
        <div className="px-4 pb-3 flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-primary/20">
            <AvatarImage src={business?.logo_url || undefined} />
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
              <span>{ad.target_city}{ad.target_neighborhood ? ` - ${ad.target_neighborhood}` : ''}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>

        {/* Media - show ad media, fallback to business cover */}
        {(ad.media_url || business?.cover_image_url) && (
          <div className="relative aspect-video bg-secondary cursor-pointer" onClick={handleCtaClick}>
            <img
              src={ad.media_url || business?.cover_image_url || ''}
              alt={ad.title || business?.business_name || ''}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-3">
          {ad.title && (
            <h3 className="font-semibold">{ad.title}</h3>
          )}
          {ad.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {ad.description}
            </p>
          )}

          {/* CTA Button */}
          {ad.call_to_action && (
            <Button
              className="w-full"
              onClick={handleCtaClick}
            >
              {ad.call_to_action}
              {resolveAdAction(ad).kind !== 'none' && <ExternalLink className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleLike}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleComment}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-primary text-primary' : ''}`} />
          </Button>
        </div>
      </Card>
    </div>
  );
}