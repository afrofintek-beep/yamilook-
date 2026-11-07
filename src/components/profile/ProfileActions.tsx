import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';
import { Edit3, Rss, MessageCircle, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

type RelationshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

interface ProfileActionsProps {
  isOwner: boolean;
  relationshipStatus?: RelationshipStatus;
  isLoading?: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function ProfileActions({
  isOwner,
  relationshipStatus = 'none',
  isLoading = false,
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel,
  secondaryLabel,
}: ProfileActionsProps) {
  useUiLocale();
  const { t } = useTranslation();

  const getOwnerActions = () => (
    <>
      <Button
        onClick={onPrimaryAction}
        className="flex-1 h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 gap-2"
      >
        <Rss className="w-4 h-4" />
        {primaryLabel || uiText("Ver Muxi")}
      </Button>
      <Button
        onClick={onSecondaryAction}
        variant="outline"
        className="flex-1 h-12 rounded-full border-2 font-semibold hover:bg-muted/50 transition-all duration-200 gap-2"
      >
        <Edit3 className="w-4 h-4" />
        {secondaryLabel || t('profile.editProfile')}
      </Button>
    </>
  );

  const getVisitorActions = () => {
    const getPrimaryButton = () => {
      if (isLoading) {
        return (
          <Button
            disabled
            className="flex-1 h-12 rounded-full font-semibold shadow-lg"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </Button>
        );
      }

      switch (relationshipStatus) {
        case 'friends':
          return (
            <Button
              disabled
              className="flex-1 h-12 rounded-full bg-muted text-foreground font-semibold gap-2"
            >
              <UserCheck className="w-4 h-4" />
              {t('social.connected')}
            </Button>
          );
        case 'pending_sent':
          return (
            <Button
              onClick={onPrimaryAction}
              variant="outline"
              className="flex-1 h-12 rounded-full border-2 font-semibold hover:bg-muted/50 transition-all duration-200"
            >
              {t('social.pending')}
            </Button>
          );
        case 'pending_received':
          return (
            <Button
              onClick={onPrimaryAction}
              className="flex-1 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t('social.accept')}
            </Button>
          );
        default:
          return (
            <Button
              onClick={onPrimaryAction}
              className="flex-1 h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {primaryLabel || t('social.connect')}
            </Button>
          );
      }
    };

    return (
      <>
        {getPrimaryButton()}
        <Button
          onClick={onSecondaryAction}
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full border-2 shadow-md hover:shadow-lg hover:bg-muted/50 transition-all duration-200"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
      </>
    );
  };

  return (
    <motion.div
      className="flex gap-3 justify-center px-6 mb-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3 }}
    >
      {isOwner ? getOwnerActions() : getVisitorActions()}
    </motion.div>
  );
}
