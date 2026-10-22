import { genderCtx } from '@/lib/i18n-gender';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  UserPlus,
  Users,
  Star,
  Clock,
  ChevronLeft,
  Bell,
  Circle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { useCloseFriends } from '@/hooks/useCloseFriends';
import { ContactCard } from '@/components/contacts/ContactCard';
import { FriendRequestCard } from '@/components/contacts/FriendRequestCard';
import { AddContactSheet } from '@/components/contacts/AddContactSheet';
import { CloseFriendsSheet } from '@/components/contacts/CloseFriendsSheet';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';

export default function Contacts() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const {
    contacts,
    friendRequests,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeContact,
    toggleFavorite,
    blockContact,
    updateNickname,
    searchUsers,
  } = useContacts();
  const { closeFriends, loading: closeFriendsLoading } = useCloseFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [closeFriendsOpen, setCloseFriendsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Filter contacts based on search and tab
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.nickname?.toLowerCase().includes(query) ||
          c.profile?.display_name.toLowerCase().includes(query) ||
          c.profile?.username.toLowerCase().includes(query)
      );
    }

    // Tab filter
    if (activeTab === 'favorites') {
      filtered = filtered.filter((c) => c.is_favorite);
    } else if (activeTab === 'bradas') {
      const closeFriendSet = new Set(closeFriends);
      filtered = filtered.filter((c) => closeFriendSet.has(c.contact_user_id));
    } else if (activeTab === 'online') {
      filtered = filtered.filter((c) => c.profile?.is_online);
    }

    // Sort: favorites first, then online, then alphabetically
    return filtered.sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      if (a.profile?.is_online !== b.profile?.is_online) {
        return a.profile?.is_online ? -1 : 1;
      }
      const nameA = a.nickname || a.profile?.display_name || '';
      const nameB = b.nickname || b.profile?.display_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [contacts, searchQuery, activeTab, closeFriends]);

  // Separate received and sent requests
  const receivedRequests = friendRequests.filter((r) => r.receiver_id === user?.id);
  const sentRequests = friendRequests.filter((r) => r.sender_id === user?.id);

  const existingContactIds = contacts.map((c) => c.contact_user_id);
  const pendingRequestIds = friendRequests.flatMap((r) => [r.sender_id, r.receiver_id]);

  const handleToggleFavorite = async (id: string) => {
    const { error } = await toggleFavorite(id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await removeContact(id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Contact removed' });
    }
  };

  const handleBlock = async (id: string) => {
    const { error } = await blockContact(id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User blocked' });
    }
  };

  const handleUpdateNickname = async (id: string, nickname: string) => {
    const { error } = await updateNickname(id, nickname);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAcceptRequest = async (id: string) => {
    const { error } = await acceptFriendRequest(id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Friend request accepted!' });
    }
  };

  const handleRejectRequest = async (id: string) => {
    const { error } = await rejectFriendRequest(id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancelRequest = async (id: string) => {
    const { error } = await cancelFriendRequest(id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="h-screen-safe overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px))] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 relative z-50 bg-background border-b border-border/50 safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate('/')}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{t('contacts.title')}</h1>
              <p className="text-xs text-muted-foreground">
                {contacts.length} {t('contacts.title').toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setCloseFriendsOpen(true)}
              title={t('social.closeFriendsGroup', genderCtx(profile?.gender))}
            >
              <Circle className="w-5 h-5" />
            </Button>
            {receivedRequests.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full relative"
                onClick={() => setActiveTab('requests')}
              >
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-gradient-primary text-white text-xs">
                  {receivedRequests.length}
                </Badge>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-gradient-primary text-white"
              onClick={() => setAddContactOpen(true)}
            >
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search') + '...'}
              className="pl-10 h-11 rounded-xl bg-secondary/50"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto p-0 bg-transparent border-b border-border/30 rounded-none">
            <TabsTrigger
              value="all"
              className="flex-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Users className="w-4 h-4 mr-2" />
              {t('contacts.all') || 'All'}
            </TabsTrigger>
            <TabsTrigger
              value="bradas"
              className="flex-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Circle className="w-4 h-4 mr-2" />
              {t('social.closeFriendsGroup', genderCtx(profile?.gender))}
              {closeFriends.length > 0 && (
                <Badge className="ml-2 h-5 min-w-[20px] px-1 bg-primary/20 text-primary text-xs">
                  {closeFriends.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="favorites"
              className="flex-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <Star className="w-4 h-4 mr-2" />
              {t('contacts.favorites') || 'Favorites'}
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="flex-1 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent relative"
            >
              <Clock className="w-4 h-4 mr-2" />
              {t('contacts.friendRequests')}
              {friendRequests.length > 0 && (
                <Badge className="ml-2 h-5 min-w-[20px] px-1 bg-primary/20 text-primary text-xs">
                  {friendRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'requests' ? (
          <div>
            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('contacts.noPendingRequests') || 'No pending requests'}</h3>
                <p className="text-muted-foreground text-sm">
                  {t('contacts.requestsAppearHere') || 'Friend requests will appear here'}
                </p>
              </div>
            ) : (
              <>
                {receivedRequests.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-secondary/30">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t('contacts.received') || 'Received'} ({receivedRequests.length})
                      </span>
                    </div>
                    <AnimatePresence>
                      {receivedRequests.map((request) => (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                        >
                          <FriendRequestCard
                            request={request}
                            currentUserId={user?.id || ''}
                            onAccept={handleAcceptRequest}
                            onReject={handleRejectRequest}
                            onCancel={handleCancelRequest}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {sentRequests.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-secondary/30">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t('contacts.sent') || 'Sent'} ({sentRequests.length})
                      </span>
                    </div>
                    <AnimatePresence>
                      {sentRequests.map((request) => (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                        >
                          <FriendRequestCard
                            request={request}
                            currentUserId={user?.id || ''}
                            onAccept={handleAcceptRequest}
                            onReject={handleRejectRequest}
                            onCancel={handleCancelRequest}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              {activeTab === 'bradas' ? (
                <Circle className="w-8 h-8 text-muted-foreground" />
              ) : (
                <Users className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery
                ? t('contacts.noContactsFound') || 'No contacts found'
                : activeTab === 'bradas'
                ? t('social.closeFriendsNoContacts') || 'No close friends yet'
                : activeTab === 'favorites'
                ? t('contacts.noFavorites') || 'No favorites yet'
                : t('contacts.noContacts')}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {searchQuery
                ? t('contacts.tryDifferentSearch') || 'Try a different search term'
                : t('contacts.addFriendsToChat') || 'Add friends to start chatting'}
            </p>
            {!searchQuery && (
              <Button
                className="rounded-xl bg-gradient-primary text-white"
                onClick={() => setAddContactOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {t('contacts.addContact')}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence>
              {filteredContacts.map((contact) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <ContactCard
                    contact={contact}
                    onToggleFavorite={handleToggleFavorite}
                    onRemove={handleRemove}
                    onBlock={handleBlock}
                    onUpdateNickname={handleUpdateNickname}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Contact Sheet */}
      <AddContactSheet
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
        onSearch={searchUsers}
        onSendRequest={sendFriendRequest}
        existingContactIds={existingContactIds}
        pendingRequestIds={pendingRequestIds}
      />

      {/* Close Friends Sheet */}
      <CloseFriendsSheet
        open={closeFriendsOpen}
        onOpenChange={setCloseFriendsOpen}
      />

      <BottomNav />
    </div>
  );
}
