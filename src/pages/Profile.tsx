import { useUserStatus } from '@/hooks/useOnlineStatus';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MoreVertical,
  Share2,
  Ban,
  Flag,
  QrCode,
  LogOut,
  Settings,
  Megaphone,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useChat';
import { useContacts } from '@/hooks/useContacts';
import { useHighlights } from '@/hooks/useHighlights';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProfileEditSheet } from '@/components/profile/ProfileEditSheet';
import { ProfilePhotosGallery } from '@/components/profile/ProfilePhotosGallery';
import { ProfileQRCode } from '@/components/profile/ProfileQRCode';
import BottomNav from '@/components/BottomNav';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileBio } from '@/components/profile/ProfileBio';
import { ProfileBadges } from '@/components/profile/ProfileBadges';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { ProfileActions } from '@/components/profile/ProfileActions';
import { ProfileHighlights } from '@/components/profile/ProfileHighlights';
import { CreateHighlightSheet } from '@/components/profile/CreateHighlightSheet';
import { HighlightViewer } from '@/components/profile/HighlightViewer';
import { YamilookJourneySheet } from '@/components/profile/YamilookJourneySheet';
import { ProfileLevel } from '@/components/profile/ProfileLevel';
import KumbuBalanceCard from '@/features/kumbu/components/KumbuBalanceCard';
import { ProfileAchievements, type Achievement } from '@/components/profile/ProfileAchievements';
import { ProfileContributions } from '@/components/profile/ProfileContributions';

type PhotosVisibility = 'everyone' | 'friends' | 'nobody';

interface ProfileData {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  status_message: string | null;
  is_online: boolean;
  last_seen: string;
  profile_theme_color: string;
  created_at: string;
  founder_number?: number | null;
  is_creator?: boolean | null;
  show_last_seen: boolean;
  show_online_status: boolean;
  show_read_receipts: boolean;
  show_typing_indicators: boolean;
  photos_visibility?: PhotosVisibility;
}

interface ProfilePhoto {
  id: string;
  photo_url: string;
  is_primary: boolean;
  display_order: number;
}

type RelationshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const { createConversation } = useConversations();
  const { contacts, friendRequests, sendFriendRequest, acceptFriendRequest, cancelFriendRequest, refresh: refreshContacts } = useContacts();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [bandaName, setBandaName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPhotosOpen, setIsPhotosOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Stats for profile
  const [postsCount, setPostsCount] = useState(0);
  const [ritmosCount, setRitmosCount] = useState(0);
  const [momambosCount, setMomambosCount] = useState(0);
  const [sessionsCreated, setSessionsCreated] = useState(0);
  const [sessionsAttended, setSessionsAttended] = useState(0);
  const [userRole, setUserRole] = useState<'founder' | 'verified_creator' | 'default'>('default');
  
  // Highlights state
  const [isCreateHighlightOpen, setIsCreateHighlightOpen] = useState(false);
  const [isHighlightViewerOpen, setIsHighlightViewerOpen] = useState(false);
  const [isYamilookJourneyOpen, setIsYamilookJourneyOpen] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<{ id: string; title: string; cover_url: string | null } | null>(null);
  const [highlightItems, setHighlightItems] = useState<Array<{ id: string; highlight_id: string; media_url: string; media_type: string; caption: string | null; created_at: string; display_order: number }>>([]);

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;
  const livePresence = useUserStatus(targetUserId ?? null);
  
  // Highlights hook
  const { 
    highlights, 
    loading: highlightsLoading, 
    createHighlight, 
    deleteHighlight, 
    addItemToHighlight, 
    getHighlightItems,
    reorderHighlights,
    refresh: refreshHighlights 
  } = useHighlights(targetUserId);

  // Determine relationship status with this user
  const getRelationshipStatus = (): RelationshipStatus => {
    if (!user || !targetUserId || isOwnProfile) return 'none';

    const isContact = contacts.some(c => c.contact_user_id === targetUserId);
    if (isContact) return 'friends';

    const sentRequest = friendRequests.find(
      r => r.sender_id === user.id && r.receiver_id === targetUserId && r.status === 'pending'
    );
    if (sentRequest) return 'pending_sent';

    const receivedRequest = friendRequests.find(
      r => r.sender_id === targetUserId && r.receiver_id === user.id && r.status === 'pending'
    );
    if (receivedRequest) return 'pending_received';

    return 'none';
  };

  const relationshipStatus = getRelationshipStatus();

  const pendingRequestId = friendRequests.find(
    r => (r.sender_id === user?.id && r.receiver_id === targetUserId) ||
      (r.sender_id === targetUserId && r.receiver_id === user?.id)
  )?.id;

  const handleFollow = async () => {
    if (!user || !targetUserId) return;

    setFollowLoading(true);
    try {
      if (relationshipStatus === 'none') {
        const { error } = await sendFriendRequest(targetUserId);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t('contacts.requestSent') || 'Friend request sent!');
        }
      } else if (relationshipStatus === 'pending_sent' && pendingRequestId) {
        const { error } = await cancelFriendRequest(pendingRequestId);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t('contacts.requestCancelled') || 'Request cancelled');
        }
      } else if (relationshipStatus === 'pending_received' && pendingRequestId) {
        const { error } = await acceptFriendRequest(pendingRequestId);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t('contacts.requestAccepted') || 'Friend request accepted!');
        }
      }
      await refreshContacts();
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenChat = async () => {
    if (!user || !targetUserId || targetUserId === user.id) return;

    const { data, error } = await createConversation([targetUserId]);
    if (error || !data) {
      toast.error('Não foi possível abrir o chat');
      return;
    }

    navigate(`/chat/${data.id}`);
  };

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
      fetchPhotos();
      fetchPublicStats();
      fetchBanda();
      fetchAcademiaStats();
      fetchUserRole();
    }
  }, [targetUserId]);

  const fetchBanda = async () => {
    if (!targetUserId) return;

    // Check privacy setting for non-own profiles
    if (!isOwnProfile && user) {
      const { data: targetSettings } = await supabase
        .from('user_settings')
        .select('show_banda')
        .eq('user_id', targetUserId)
        .maybeSingle();

      const visibility = targetSettings?.show_banda ?? 'everyone';

      if (visibility === 'nobody') return;

      if (visibility === 'friends') {
        // Check if viewer is a Kamba
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('contact_user_id', user.id)
          .maybeSingle();
        if (!contact) return;
      }

      if (visibility === 'close_friends') {
        // Check if viewer is a Brada
        const { data: closeFriend } = await supabase
          .from('close_friends')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('friend_id', user.id)
          .maybeSingle();
        if (!closeFriend) return;
      }
    }

    const { data: userBanda } = await supabase
      .from('user_bandas')
      .select('banda_id')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!userBanda?.banda_id) return;

    const { data: banda } = await supabase
      .from('bandas')
      .select('name, city')
      .eq('id', userBanda.banda_id)
      .maybeSingle();
    
    if (banda) {
      const parts = [banda.name, banda.city].filter(Boolean);
      setBandaName(parts.join(', ') || null);
    }
  };

  const fetchPublicStats = async () => {
    if (!targetUserId) return;
    
    // Fetch posts count (public data)
    const { count: posts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);
    
    // Fetch ritmos count (public data)
    const { count: ritmos } = await supabase
      .from('ritmos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);
    
    // Fetch momambos count (profile highlights)
    const { count: momambos } = await supabase
      .from('profile_highlights')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);
    
    setPostsCount(posts || 0);
    setRitmosCount(ritmos || 0);
    setMomambosCount(momambos || 0);
  };

  const fetchAcademiaStats = async () => {
    if (!targetUserId) return;
    
    const { count: created } = await supabase
      .from('academia_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('mentor_id', targetUserId);
    
    const { count: attended } = await supabase
      .from('academia_reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);
    
    setSessionsCreated(created || 0);
    setSessionsAttended(attended || 0);
  };

  const fetchUserRole = async () => {
    if (!targetUserId) return;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId);
    
    // Note: user_roles is RLS-restricted to self/admin, so this only resolves on
    // your own profile. The "Criador Verificado" badge is driven by the PUBLIC
    // profiles.is_creator flag instead (see displayRole), so others can see it too.
    if (data && data.length > 0) {
      const roles = data.map(r => r.role);
      if (roles.includes('admin')) {
        setUserRole('founder');
      }
    }
  };

  const fetchProfile = async () => {
    if (!targetUserId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      toast.error(t('profile.failedToLoad'));
      navigate(-1);
      return;
    }

    if (!data) {
      // Profile not found - navigate back silently
      navigate(-1);
      return;
    }

    setProfileData(data as ProfileData);
    setLoading(false);
  };

  const fetchPhotos = async () => {
    if (!targetUserId) return;

    const { data } = await supabase
      .from('profile_photos')
      .select('*')
      .eq('user_id', targetUserId)
      .order('display_order', { ascending: true });

    if (data) {
      setProfilePhotos(data as ProfilePhoto[]);
    }
  };

  const handleShare = async () => {
    // Prefer the public /u/<username> link (viewable without login); fall back to
    // the in-app profile when there's no username.
    const shareUrl = profileData?.username
      ? `${window.location.origin}/u/${profileData.username}`
      : `${window.location.origin}/profile/${targetUserId}`;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const canNativeShare = Boolean(navigator.share) && window.isSecureContext && !isInIframe;

    if (canNativeShare) {
      try {
        await navigator.share({
          title: `${profileData?.display_name} on Yamilook`,
          text: `Check out ${profileData?.display_name}'s profile on Yamilook`,
          url: shareUrl,
        });
        return;
      } catch {
        // fall through to copy
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    toast.success(t('profile.linkCopied'));
  };

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error(t('errors.generic') || 'Could not log out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const handleAvatarClick = () => {
    if (profilePhotos.length > 0 || profileData?.avatar_url) {
      setSelectedPhotoIndex(0);
      setIsPhotosOpen(true);
    }
  };

  // Build bio lines from profile data
  const getBioLines = (): string[] => {
    if (!profileData?.bio) return [];
    return profileData.bio.split('\n').filter(line => line.trim());
  };

  // Build stats from available data
  // Owner sees all stats, visitors only see public stats (posts, momambos, ritmos)
  const scrollToMomambos = () => {
    document.getElementById('momambo-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStats = () => {
    const publicStats = [
      { icon: 'posts' as const, label: t('feed.posts', 'Publicações'), value: postsCount, onClick: () => navigate('/feed') },
      { icon: 'momambos' as const, label: t('profile.momambos', 'Momambos'), value: momambosCount, onClick: scrollToMomambos },
      { icon: 'ritmos' as const, label: t('profile.ritmos', 'Ritmos'), value: ritmosCount, onClick: () => navigate('/ritmos') },
    ];

    const ownerOnlyStats = [
      { icon: 'users' as const, label: t('social.friends', 'Kambas'), value: contacts.length, onClick: () => navigate('/contacts'), ownerOnly: true },
      { icon: 'image' as const, label: t('profile.photos', 'Fotos'), value: profilePhotos.length, onClick: () => setIsPhotosOpen(true), ownerOnly: true },
    ];

    return [...publicStats, ...ownerOnlyStats];
  };

  // Effective role for badge/level: founder wins; otherwise the PUBLIC is_creator
  // flag (from profiles, readable by everyone) drives "Criador Verificado".
  const displayRole: 'founder' | 'verified_creator' | 'default' =
    userRole === 'founder'
      ? 'founder'
      : profileData?.is_creator
        ? 'verified_creator'
        : userRole;

  // Build badges based on profile
  const getBadges = () => {
    const badges: { type: string; label: string }[] = [];
    // First 100 members of the network — "Fundador #N" (see founder_number).
    if (profileData?.founder_number) {
      badges.push({ type: 'founder', label: `Fundador #${profileData.founder_number}` });
    }
    if (displayRole === 'verified_creator') {
      badges.push({ type: 'verified', label: 'Criador Verificado' });
    }
    if (sessionsCreated > 0) {
      badges.push({ type: 'creator', label: 'Mentor' });
    }
    if (contacts.length >= 10) {
      badges.push({ type: 'community', label: 'Comunidade' });
    }
    return badges;
  };

  // Build achievements
  const getAchievements = (): Achievement[] => {
    const achievements: Achievement[] = [];
    if (postsCount > 0) {
      achievements.push({ id: 'posts', icon: 'book', label: t('feed.posts', 'Publicações'), value: postsCount.toString() });
    }
    if (ritmosCount > 0) {
      achievements.push({ id: 'ritmos', icon: 'star', label: t('profile.ritmos', 'Ritmos'), value: ritmosCount.toString() });
    }
    if (momambosCount > 0) {
      achievements.push({ id: 'momambos', icon: 'trophy', label: t('profile.momambos', 'Momambos'), value: momambosCount.toString() });
    }
    if (contacts.length > 0 && isOwnProfile) {
      achievements.push({ id: 'kambas', icon: 'community', label: t('social.friends', 'Kambas'), value: contacts.length.toString() });
    }
    if (profilePhotos.length > 0 && isOwnProfile) {
      achievements.push({ id: 'photos', icon: 'heart', label: t('profile.photos', 'Fotos'), value: profilePhotos.length.toString() });
    }
    if (sessionsCreated + sessionsAttended > 3) {
      achievements.push({ id: 'academia', icon: 'graduation', label: t('profile.academiaActive', 'Academia activa'), value: `${sessionsCreated + sessionsAttended}` });
    }
    return achievements;
  };

  // Build highlights from real data
  const getHighlightsForDisplay = () => {
    return highlights.map(h => ({
      id: h.id,
      title: h.title,
      coverUrl: h.cover_url,
    }));
  };
  
  const handleCreateHighlight = async (title: string, coverFile?: File) => {
    await createHighlight(title, coverFile);
  };
  
  const handleHighlightClick = async (id: string) => {
    // Handle YAMILOOK branded Momambo
    if (id === 'm_yamilook') {
      // Owner always sees their own journey
      if (isOwnProfile) {
        setIsYamilookJourneyOpen(true);
        return;
      }
      // For visitors, check journey_visibility setting
      try {
        const { data: ownerSettings } = await supabase
          .from('user_settings')
          .select('journey_visibility')
          .eq('user_id', targetUserId!)
          .maybeSingle();

        const visibility = ownerSettings?.journey_visibility || 'everyone';

        if (visibility === 'nobody') {
          toast.error('Esta jornada é privada');
          return;
        }

        if (visibility === 'friends' || visibility === 'close_friends') {
          const { data: isKamba } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', targetUserId!)
            .eq('contact_user_id', user!.id)
            .maybeSingle();

          if (!isKamba) {
            toast.error('Só os kambas podem ver esta jornada');
            return;
          }

          if (visibility === 'close_friends') {
            const { data: isBrada } = await supabase
              .from('close_friends')
              .select('id')
              .eq('user_id', targetUserId!)
              .eq('friend_id', user!.id)
              .maybeSingle();

            if (!isBrada) {
              toast.error('Só os bradas podem ver esta jornada');
              return;
            }
          }
        }

        setIsYamilookJourneyOpen(true);
      } catch {
        toast.error('Erro ao verificar acesso');
      }
      return;
    }
    
    const highlight = highlights.find(h => h.id === id);
    if (!highlight) return;
    
    setSelectedHighlight({
      id: highlight.id,
      title: highlight.title,
      cover_url: highlight.cover_url,
    });
    
    try {
      const items = await getHighlightItems(id);
      setHighlightItems(items);
      setIsHighlightViewerOpen(true);
    } catch (error) {
      toast.error('Erro ao carregar Momambo');
    }
  };
  
  const handleAddItemToHighlight = async (file: File) => {
    if (!selectedHighlight) return;
    await addItemToHighlight(selectedHighlight.id, file);
    const items = await getHighlightItems(selectedHighlight.id);
    setHighlightItems(items);
    refreshHighlights();
  };
  
  const handleDeleteHighlight = async () => {
    if (!selectedHighlight) return;
    await deleteHighlight(selectedHighlight.id);
    setSelectedHighlight(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('errors.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 safe-top">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted/80"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </motion.div>
        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted/80"
            onClick={() => setIsQROpen(true)}
          >
            <QrCode className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted/80"
              >
                <MoreVertical className="w-5 h-5" strokeWidth={2.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-border/50 bg-popover">
              <DropdownMenuItem onClick={handleShare} className="rounded-lg">
                <Share2 className="w-4 h-4 mr-2" />
                {t('feed.share')}
              </DropdownMenuItem>
              {isOwnProfile && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/kumbu')} className="rounded-lg">
                    <Coins className="w-4 h-4 mr-2" />
                    {t('kumbu.wallet', 'Carteira Kumbu')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/advertising')} className="rounded-lg">
                    <Megaphone className="w-4 h-4 mr-2" />
                    {t('settings.advertisingSettings', 'Publicidade')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-lg">
                    <Settings className="w-4 h-4 mr-2" />
                    {t('nav.settings')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="bg-destructive/10 text-destructive hover:bg-destructive/20 focus:bg-destructive/20 focus:text-destructive rounded-lg font-medium"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('settings.logOut')}
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('settings.logOutConfirm')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('settings.logOutDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleSignOut}
                          disabled={signingOut}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                        >
                          {signingOut ? t('settings.loggingOut') : t('settings.logOut')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {!isOwnProfile && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive rounded-lg">
                    <Ban className="w-4 h-4 mr-2" />
                    {t('contacts.block')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive rounded-lg">
                    <Flag className="w-4 h-4 mr-2" />
                    {t('contacts.report')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>

      {/* Profile Header */}
      <ProfileHeader
        avatarUrl={profileData.avatar_url}
        name={profileData.display_name}
        subtitle={profileData.status_message}
        username={profileData.username}
        bandaName={bandaName}
        isVerified={displayRole !== 'default'}
        role={displayRole}
        isOnline={livePresence.is_online}
        showOnlineStatus={livePresence.show_online_status}
        onAvatarClick={handleAvatarClick}
      />

      {/* Level indicator */}
      <div className="mb-4">
        <ProfileLevel role={displayRole} />
      </div>

      {/* Bio */}
      <ProfileBio lines={getBioLines()} />

      {/* Badges */}
      <ProfileBadges badges={getBadges()} />

      {/* Action Buttons */}
      <ProfileActions
        isOwner={isOwnProfile}
        relationshipStatus={relationshipStatus}
        isLoading={followLoading}
        onPrimaryAction={isOwnProfile ? () => navigate('/feed') : handleFollow}
        onSecondaryAction={isOwnProfile ? () => setIsEditOpen(true) : handleOpenChat}
      />

      {/* Kumbu wallet — own profile only (entry point to /kumbu) */}
      {isOwnProfile && (
        <button
          type="button"
          onClick={() => navigate('/kumbu')}
          aria-label={t('kumbu.openWallet', 'Ver a minha Carteira Kumbu')}
          className="group w-full text-left mb-4 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-transform active:scale-[0.99]"
        >
          <KumbuBalanceCard />
          <div className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
            {t('kumbu.viewWallet', 'Ver carteira e histórico')} ›
          </div>
        </button>
      )}

      {/* Stats */}
      <ProfileStats items={getStats()} hideZeros animateCountUp isOwner={isOwnProfile} />

      {/* Achievements */}
      <ProfileAchievements achievements={getAchievements()} />

      {/* Academia contributions */}
      <ProfileContributions
        sessionsCreated={sessionsCreated}
        sessionsAttended={sessionsAttended}
        isOwner={isOwnProfile}
      />

      {/* Momambos */}
      <div id="momambo-section">
        <ProfileHighlights
          title="MOMAMBO"
          subtitle="Momentos que ficam"
          items={getHighlightsForDisplay()}
          isOwner={isOwnProfile}
          loading={highlightsLoading}
          emptyState={{
            title: 'Sem Momambos ainda',
            subtitle: 'Momentos, projetos e ideias que contam.',
          }}
          onCreateHighlight={() => setIsCreateHighlightOpen(true)}
          onHighlightClick={handleHighlightClick}
          onReorder={reorderHighlights}
        />
      </div>

      {/* Create Momambo Sheet */}
      <CreateHighlightSheet
        open={isCreateHighlightOpen}
        onOpenChange={setIsCreateHighlightOpen}
        onCreateHighlight={handleCreateHighlight}
      />

      {/* Momambo Viewer */}
      <HighlightViewer
        open={isHighlightViewerOpen}
        onOpenChange={setIsHighlightViewerOpen}
        highlight={selectedHighlight ? { 
          id: selectedHighlight.id, 
          user_id: targetUserId || '', 
          title: selectedHighlight.title, 
          cover_url: selectedHighlight.cover_url, 
          created_at: '', 
          updated_at: '', 
          display_order: 0 
        } : null}
        items={highlightItems}
        isOwner={isOwnProfile}
        onAddItem={handleAddItemToHighlight}
        onDeleteHighlight={handleDeleteHighlight}
      />

      {/* Edit Sheet */}
      <ProfileEditSheet
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        profile={profileData}
        onUpdate={() => {
          fetchProfile();
          fetchPhotos();
        }}
      />

      {/* Photos Gallery */}
      <ProfilePhotosGallery
        open={isPhotosOpen}
        onOpenChange={setIsPhotosOpen}
        photos={profilePhotos}
        avatarUrl={profileData.avatar_url}
        isOwnProfile={isOwnProfile}
        selectedIndex={selectedPhotoIndex}
        onPhotosUpdate={fetchPhotos}
      />

      {/* QR Code Modal */}
      <ProfileQRCode
        open={isQROpen}
        onOpenChange={setIsQROpen}
        profile={{ ...profileData, bandaName }}
      />

      {/* Yamilook Journey Sheet */}
      <YamilookJourneySheet
        open={isYamilookJourneyOpen}
        onOpenChange={setIsYamilookJourneyOpen}
        userId={targetUserId || ''}
        displayName={profileData.display_name}
      />

      <BottomNav />
    </div>
  );
}
