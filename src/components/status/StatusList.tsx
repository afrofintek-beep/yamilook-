import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StatusRing } from './StatusRing';


import { LiveIndicatorBadge } from '@/components/live/LiveIndicatorBadge';
import { LivePreviewTooltip } from '@/components/live/LivePreviewTooltip';
import { useStatus, GroupedStatuses } from '@/hooks/useStatus';
import { useAuth } from '@/hooks/useAuth';
import { useActiveStreams } from '@/hooks/useActiveStreams';

// Status viewers/editors are never required to display the horizontal story rings.
// Load them when opened, retaining their state during subsequent close/reopen.
const StatusViewer = lazy(() => import('./StatusViewer').then(m => ({ default: m.StatusViewer })));
const CreateStatusSheet = lazy(() => import('./CreateStatusSheet').then(m => ({ default: m.CreateStatusSheet })));


export function StatusList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { myStatuses, contactStatuses, loading } = useStatus();
  const { hasActiveStreams, activeStreams } = useActiveStreams();
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerEverOpened, setViewerEverOpened] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedStatuses | null>(null);
  const [isViewingOwn, setIsViewingOwn] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createEverOpened, setCreateEverOpened] = useState(false);

  const handleViewMyStatus = () => {
    if (myStatuses.length === 0) {
      setCreateEverOpened(true);
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
      setViewerEverOpened(true);
      setViewerOpen(true);
    }
  };

  const handleViewContactStatus = (group: GroupedStatuses) => {
    setSelectedGroup(group);
    setIsViewingOwn(false);
    setViewerEverOpened(true);
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

  if (loading) {
    return (
      <div className="py-4">
        <div className="flex gap-4 px-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-secondary animate-pulse" />
              <div className="w-12 h-3 bg-secondary animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 py-4 px-4">
          {/* My Status */}
          <motion.div
            data-testid="my-status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-1 flex-shrink-0"
            style={{ minWidth: '76px', maxWidth: '76px' }}
          >
            <StatusRing
              avatarUrl={myStatuses[0]?.user?.avatar_url || user?.user_metadata?.avatar_url}
              displayName={myStatuses[0]?.user?.display_name || user?.user_metadata?.display_name || user?.email?.charAt(0) || 'M'}
              hasStatus={myStatuses.length > 0}
              isOwn={true}
              onClick={handleViewMyStatus}
            />
            <span className="text-[11px] leading-tight text-muted-foreground text-center w-full px-0.5 line-clamp-2">
              {t('status.myStatus')}
            </span>
          </motion.div>

          {/* Abrir o Palco button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="flex flex-col items-center gap-1 flex-shrink-0"
            style={{ minWidth: '76px', maxWidth: '76px' }}
          >
            <LivePreviewTooltip activeStreams={activeStreams} hasActiveStreams={hasActiveStreams}>
              <button
                onClick={() => navigate('/banda')}
                className="relative w-16 h-16 rounded-full bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center shadow-md"
              >
                <Radio className="w-7 h-7 text-destructive-foreground" />
                {hasActiveStreams && <LiveIndicatorBadge className="top-0 right-0" />}
              </button>
            </LivePreviewTooltip>
            <span className="text-[11px] leading-tight text-destructive font-medium text-center w-full px-0.5 line-clamp-2">
              Banda ao vivo
            </span>
          </motion.div>

          {/* Contact statuses */}
          {contactStatuses.length > 0 ? (
            contactStatuses.map((group, index) => (
              <motion.div
                key={group.user_id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (index + 1) * 0.05 }}
                className="flex flex-col items-center gap-1 flex-shrink-0"
                style={{ minWidth: '76px', maxWidth: '76px' }}
              >
                <StatusRing
                  avatarUrl={group.user.avatar_url}
                  displayName={group.user.display_name}
                  hasStatus={true}
                  hasUnviewed={group.has_unviewed}
                  onClick={() => handleViewContactStatus(group)}
                />
                <span className="text-[11px] leading-tight text-muted-foreground text-center w-full px-0.5 line-clamp-2">
                  {group.user.display_name.split(' ')[0]}
                </span>
              </motion.div>
            ))
          ) : (
            <div data-testid="empty-contact-statuses" className="flex items-center py-2 px-3 ml-2 border-l border-border">
              <p className="text-xs text-muted-foreground leading-tight max-w-[180px]">
                {t('status.noUpdatesDesc')}
              </p>
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Keep the viewer available after its first launch for scroll-back continuity. */}
      {viewerEverOpened && (
        <Suspense fallback={null}>
          <StatusViewer
            open={viewerOpen}
            onClose={() => setViewerOpen(false)}
            initialGroup={selectedGroup}
            allGroups={allViewableGroups}
            isOwnStatus={isViewingOwn}
          />
        </Suspense>
      )}

      {/* Defer all status creation media/editor UI until the user taps their ring. */}
      {createEverOpened && (
        <Suspense fallback={null}>
          <CreateStatusSheet
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
        </Suspense>
      )}
    </>
  );
}
