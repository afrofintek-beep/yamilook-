import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Plus, 
  MoreVertical, 
  Eye,
  VolumeX,
  Settings,
  Camera,
  Image,
  Type,
  Archive,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusRing } from '@/components/status/StatusRing';
import { StatusViewer } from '@/components/status/StatusViewer';
import { CreateStatusSheet } from '@/components/status/CreateStatusSheet';
import { useStatus, GroupedStatuses } from '@/hooks/useStatus';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function Status() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { 
    myStatuses, 
    contactStatuses, 
    mutedContacts,
    loading,
    toggleMuteContact,
    getArchivedStatuses,
  } = useStatus();
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedStatuses | null>(null);
  const [isViewingOwn, setIsViewingOwn] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [archivedStatuses, setArchivedStatuses] = useState<Tables<'statuses'>[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    getArchivedStatuses().then(setArchivedStatuses);
  }, [getArchivedStatuses]);

  const handleViewMyStatus = () => {
    if (myStatuses.length === 0) {
      setCreateOpen(true);
    } else {
      const myGroup: GroupedStatuses = {
        user_id: user?.id || '',
        user: myStatuses[0].user,
        statuses: myStatuses,
        has_unviewed: false,
        latest_at: myStatuses[0].created_at,
      };
      setSelectedGroup(myGroup);
      setIsViewingOwn(true);
      setViewerOpen(true);
    }
  };

  const handleViewContactStatus = (group: GroupedStatuses) => {
    setSelectedGroup(group);
    setIsViewingOwn(false);
    setViewerOpen(true);
  };

  const allViewableGroups = isViewingOwn 
    ? [{ 
        user_id: user?.id || '', 
        user: myStatuses[0]?.user || { id: '', display_name: 'You', avatar_url: null, username: '' },
        statuses: myStatuses,
        has_unviewed: false,
        latest_at: myStatuses[0]?.created_at || '',
      }]
    : contactStatuses;

  // Separate viewed and unviewed
  const recentUpdates = contactStatuses.filter(g => g.has_unviewed);
  const viewedUpdates = contactStatuses.filter(g => !g.has_unviewed);

  return (
    <div className="h-screen-safe overflow-hidden pb-[env(safe-area-inset-bottom,0px)] bg-background flex flex-col">
      {/* Header */}
      <header className="shrink-0 relative z-50 glass border-b border-border/50 safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">{t('status.title')}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowArchived(true)}>
                <Archive className="w-4 h-4 mr-2" />
                {t('status.viewArchived')}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                {t('status.privacy')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-y-contain">
        <div className="p-4 space-y-6">
          {/* My Status */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary/50 cursor-pointer"
              onClick={handleViewMyStatus}
            >
              <div className="relative">
                <StatusRing
                  avatarUrl={myStatuses[0]?.user?.avatar_url}
                  displayName={user?.email?.charAt(0) || 'M'}
                  hasStatus={myStatuses.length > 0}
                  isOwn={true}
                  size="lg"
                  onClick={handleViewMyStatus}
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{t('status.myStatus')}</p>
                <p className="text-sm text-muted-foreground">
                  {myStatuses.length > 0 
                    ? `${myStatuses.length} ${t('status.statusCount', { count: myStatuses.length })} • ${formatDistanceToNow(new Date(myStatuses[0].created_at), { addSuffix: true })}`
                    : t('status.tapToAdd')}
                </p>
              </div>
              {myStatuses.length > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">
                    {myStatuses.reduce((sum, s) => sum + s.view_count, 0)}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Recent Updates (Unviewed) */}
          {recentUpdates.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase">
                {t('status.recentUpdates')}
              </h3>
              <div className="space-y-1">
                <AnimatePresence>
                  {recentUpdates.map((group, index) => (
                    <motion.div
                      key={group.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary/50 cursor-pointer"
                      onClick={() => handleViewContactStatus(group)}
                    >
                      <StatusRing
                        avatarUrl={group.user.avatar_url}
                        displayName={group.user.display_name}
                        hasStatus={true}
                        hasUnviewed={true}
                        size="lg"
                        onClick={() => handleViewContactStatus(group)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{group.user.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.statuses.length} status{group.statuses.length > 1 ? 'es' : ''} •{' '}
                          {formatDistanceToNow(new Date(group.latest_at), { addSuffix: true })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Viewed Updates */}
          {viewedUpdates.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase">
                {t('status.viewedUpdates')}
              </h3>
              <div className="space-y-1">
                <AnimatePresence>
                  {viewedUpdates.map((group, index) => (
                    <motion.div
                      key={group.user_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-secondary/50 cursor-pointer group"
                      onClick={() => handleViewContactStatus(group)}
                    >
                      <StatusRing
                        avatarUrl={group.user.avatar_url}
                        displayName={group.user.display_name}
                        hasStatus={true}
                        hasUnviewed={false}
                        size="lg"
                        onClick={() => handleViewContactStatus(group)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{group.user.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(group.latest_at), { addSuffix: true })}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            toggleMuteContact(group.user_id);
                          }}>
                            <VolumeX className="w-4 h-4 mr-2" />
                            {t('status.mute')} {group.user.display_name}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty state */}
          {contactStatuses.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <Eye className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('status.noUpdates')}</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {t('status.noUpdatesDesc')}
              </p>
            </div>
          )}

          {/* Muted Updates */}
          {mutedContacts.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase">
                {t('status.mutedUpdates')}
              </h3>
              <p className="text-sm text-muted-foreground px-1">
                {mutedContacts.length} {t('status.contactsMuted', { count: mutedContacts.length })}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <Button
          size="icon"
          variant="secondary"
          className="w-12 h-12 rounded-2xl shadow-lg"
          onClick={() => setCreateOpen(true)}
        >
          <Type className="w-5 h-5" />
        </Button>
        <Button
          size="icon"
          className="w-14 h-14 rounded-2xl bg-gradient-primary text-white shadow-glow"
          onClick={() => setCreateOpen(true)}
        >
          <Camera className="w-6 h-6" />
        </Button>
      </div>

      {/* Status Viewer */}
      <StatusViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        initialGroup={selectedGroup}
        allGroups={allViewableGroups}
        isOwnStatus={isViewingOwn}
      />

      {/* Create Status Sheet */}
      <CreateStatusSheet 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
      />
    </div>
  );
}
