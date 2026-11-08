import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useAuth } from '@/hooks/useAuth';
import { genderCtx } from '@/lib/i18n-gender';
import { useState } from 'react';
import { Circle, Search, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useContacts } from '@/hooks/useContacts';
import { useCloseFriends } from '@/hooks/useCloseFriends';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getCloseFriendLabel } from '@/lib/close-friend-label';

interface CloseFriendsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloseFriendsSheet({ open, onOpenChange }: CloseFriendsSheetProps) {
  useUiLocale();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { contacts, loading: contactsLoading } = useContacts();
  const { closeFriends, toggleCloseFriend, loading: closeFriendsLoading } = useCloseFriends();
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filteredContacts = contacts.filter(contact => {
    if (!search.trim()) return true;
    const displayName = contact.nickname || contact.profile?.display_name || '';
    const username = contact.profile?.username || '';
    const searchLower = search.toLowerCase();
    return displayName.toLowerCase().includes(searchLower) ||
           username.toLowerCase().includes(searchLower);
  });

  const handleToggle = async (contactUserId: string, contactGender?: string | null) => {
    setTogglingId(contactUserId);
    const isAdding = !closeFriends.includes(contactUserId);
    const label = getCloseFriendLabel(contactGender as 'male' | 'female' | 'other' | null);

    const { error } = await toggleCloseFriend(contactUserId);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: isAdding ? uiText("Adicionado aos {{value1}}s", { value1: (label) ?? "" }) : uiText("Removido dos {{value1}}s", { value1: (label) ?? "" }),
        description: isAdding
          ? uiText("Esta pessoa verá os teus estados de {{value1}}s", { value1: (label) ?? "" })
          : uiText("Esta pessoa já não verá os teus estados de {{value1}}s", { value1: (label) ?? "" }),
      });
    }

    setTogglingId(null);
  };

  const loading = contactsLoading || closeFriendsLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Circle className="w-5 h-5 text-primary" />
            {t('social.closeFriendsGroup', genderCtx(profile?.gender))}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {t('social.closeFriendsDescription')}
          </p>
        </SheetHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('social.closeFriendsSearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="text-sm text-muted-foreground mb-2">
          {closeFriends.length} {t('social.closeFriendsSelected')}
        </div>

        <div className="space-y-1 max-h-[calc(85vh-200px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? t('social.closeFriendsNoResults') : t('social.closeFriendsNoContacts')}
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isCloseFriend = closeFriends.includes(contact.contact_user_id);
              const displayName = contact.nickname || contact.profile?.display_name || 'Unknown';
              const initials = displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <button
                  key={contact.id}
                  onClick={() => handleToggle(contact.contact_user_id, contact.profile?.gender)}
                  disabled={togglingId === contact.contact_user_id}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-colors",
                    isCloseFriend
                      ? "bg-primary/10 hover:bg-primary/20"
                      : "hover:bg-secondary"
                  )}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={contact.profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-gradient-primary text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 text-left">
                    <div className="font-medium">{displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      @{contact.profile?.username || uiText("unknown")}
                    </div>
                  </div>

                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                    isCloseFriend
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-muted-foreground/30"
                  )}>
                    {isCloseFriend && <Check className="w-4 h-4" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}