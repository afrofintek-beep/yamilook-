import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

export interface Status {
  id: string;
  user_id: string;
  type: 'photo' | 'video' | 'text';
  content: string | null;
  media_url: string | null;
  background: string | null;
  music_url: string | null;
  music_title: string | null;
  caption: string | null;
  stickers: Json;
  privacy: 'everyone' | 'contacts' | 'close_friends' | 'only_me';
  created_at: string;
  expires_at: string;
  is_archived: boolean;
}

export interface StatusWithUser extends Status {
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  view_count: number;
  has_viewed: boolean;
}

export interface GroupedStatuses {
  user_id: string;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
  statuses: StatusWithUser[];
  has_unviewed: boolean;
  latest_at: string;
}

interface StatusViewerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface StatusView {
  viewer_id: string;
  viewed_at: string;
  viewer: StatusViewerProfile | null;
}

export function useStatus() {
  const { user } = useAuth();
  const [myStatuses, setMyStatuses] = useState<StatusWithUser[]>([]);
  const [contactStatuses, setContactStatuses] = useState<GroupedStatuses[]>([]);
  const [mutedContacts, setMutedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Único por instância para não colidir no mesmo tópico do canal realtime.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Fetch my statuses
  const fetchMyStatuses = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('statuses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!data?.length) {
      setMyStatuses([]);
      return;
    }

    // Batch fetch view counts and profile
    const statusIds = data.map(s => s.id);
    const [viewsResult, profileResult] = await Promise.all([
      supabase
        .from('status_views')
        .select('status_id')
        .in('status_id', statusIds),
      supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, username')
        .eq('id', user.id)
        .maybeSingle()
    ]);

    // Count views per status
    const viewCounts = new Map<string, number>();
    viewsResult.data?.forEach(v => {
      viewCounts.set(v.status_id, (viewCounts.get(v.status_id) || 0) + 1);
    });

    const profile = profileResult.data || { id: user.id, display_name: 'You', avatar_url: null, username: '' };

    const statusesWithViews = data.map(status => ({
      ...status,
      type: status.type as 'photo' | 'video' | 'text',
      privacy: status.privacy as 'everyone' | 'contacts' | 'close_friends' | 'only_me',
      stickers: Array.isArray(status.stickers) ? status.stickers : [],
      user: profile,
      view_count: viewCounts.get(status.id) || 0,
      has_viewed: true,
    } as StatusWithUser));

    setMyStatuses(statusesWithViews);
  }, [user]);

  // Fetch contact statuses
  const fetchContactStatuses = useCallback(async () => {
    if (!user) return;

    // Get muted contacts and contacts in parallel
    const [mutedResult, contactsResult] = await Promise.all([
      supabase
        .from('muted_status_contacts')
        .select('muted_user_id')
        .eq('user_id', user.id),
      supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id)
    ]);

    const mutedIds = mutedResult.data?.map(m => m.muted_user_id) || [];
    setMutedContacts(mutedIds);

    if (!contactsResult.data?.length) {
      setContactStatuses([]);
      setLoading(false);
      return;
    }

    const contactIds = contactsResult.data.map(c => c.contact_user_id);

    // Fetch statuses from contacts
    const { data: statuses } = await supabase
      .from('statuses')
      .select('*')
      .in('user_id', contactIds)
      .eq('is_archived', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!statuses?.length) {
      setContactStatuses([]);
      setLoading(false);
      return;
    }

    // Batch fetch all profiles and views
    const statusUserIds = [...new Set(statuses.map(s => s.user_id))];
    const statusIds = statuses.map(s => s.id);

    const [profilesResult, viewsResult] = await Promise.all([
      supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, username')
        .in('id', statusUserIds),
      supabase
        .from('status_views')
        .select('status_id')
        .in('status_id', statusIds)
        .eq('viewer_id', user.id)
    ]);

    const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
    const viewedSet = new Set(viewsResult.data?.map(v => v.status_id) || []);

    // Build grouped statuses
    const groupedMap = new Map<string, GroupedStatuses>();

    for (const status of statuses) {
      const profile = profileMap.get(status.user_id);
      const statusWithUser: StatusWithUser = {
        ...status,
        type: status.type as 'photo' | 'video' | 'text',
        privacy: status.privacy as 'everyone' | 'contacts' | 'close_friends' | 'only_me',
        stickers: Array.isArray(status.stickers) ? status.stickers : [],
        user: profile || { id: status.user_id, display_name: 'Unknown', avatar_url: null, username: '' },
        view_count: 0,
        has_viewed: viewedSet.has(status.id),
      };

      if (!groupedMap.has(status.user_id)) {
        groupedMap.set(status.user_id, {
          user_id: status.user_id,
          user: statusWithUser.user,
          statuses: [],
          has_unviewed: false,
          latest_at: status.created_at,
        });
      }

      const group = groupedMap.get(status.user_id)!;
      group.statuses.push(statusWithUser);
      if (!statusWithUser.has_viewed) {
        group.has_unviewed = true;
      }
    }

    // Sort: unviewed first, then by latest
    const sorted = Array.from(groupedMap.values())
      .filter(g => !mutedIds.includes(g.user_id))
      .sort((a, b) => {
        if (a.has_unviewed && !b.has_unviewed) return -1;
        if (!a.has_unviewed && b.has_unviewed) return 1;
        return new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime();
      });

    setContactStatuses(sorted);
    setLoading(false);
  }, [user]);

  // Create status
  const createStatus = useCallback(async (
    type: 'photo' | 'video' | 'text',
    options: {
      content?: string;
      mediaFile?: File;
      background?: string;
      caption?: string;
      stickers?: Json;
      privacy?: 'everyone' | 'contacts' | 'close_friends' | 'only_me';
    }
  ) => {
    if (!user) return null;

    let mediaUrl = null;

    if (options.mediaFile) {
      const fileExt = options.mediaFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('status-media')
        .upload(fileName, options.mediaFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('status-media')
        .getPublicUrl(fileName);

      mediaUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from('statuses')
      .insert({
        user_id: user.id,
        type,
        content: options.content,
        media_url: mediaUrl,
        background: options.background,
        caption: options.caption,
        stickers: options.stickers || [],
        privacy: options.privacy || 'contacts',
      })
      .select()
      .single();

    if (error) {
      console.error('Create status error:', error);
      return null;
    }

    await fetchMyStatuses();
    return data;
  }, [user, fetchMyStatuses]);

  // Delete status
  const deleteStatus = useCallback(async (statusId: string) => {
    if (!user) return;

    await supabase
      .from('statuses')
      .delete()
      .eq('id', statusId)
      .eq('user_id', user.id);

    await fetchMyStatuses();
  }, [user, fetchMyStatuses]);

  // Archive status
  const archiveStatus = useCallback(async (statusId: string) => {
    if (!user) return;

    await supabase
      .from('statuses')
      .update({ is_archived: true })
      .eq('id', statusId)
      .eq('user_id', user.id);

    await fetchMyStatuses();
  }, [user, fetchMyStatuses]);

  // Mark as viewed
  const markAsViewed = useCallback(async (statusId: string) => {
    if (!user) return;

    await supabase
      .from('status_views')
      .upsert({
        status_id: statusId,
        viewer_id: user.id,
      }, {
        onConflict: 'status_id,viewer_id'
      });
  }, [user]);

  // Reply to status
  const replyToStatus = useCallback(async (statusId: string, content: string) => {
    if (!user) return;

    await supabase
      .from('status_replies')
      .insert({
        status_id: statusId,
        user_id: user.id,
        content,
      });
  }, [user]);

  // Get status views
  const getStatusViews = useCallback(async (statusId: string): Promise<StatusView[]> => {
    const { data } = await supabase
      .from('status_views')
      .select(`
        viewer_id,
        viewed_at,
        profiles:viewer_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('status_id', statusId)
      .order('viewed_at', { ascending: false });

    return data?.map(v => ({
      viewer_id: v.viewer_id,
      viewed_at: v.viewed_at,
      viewer: Array.isArray(v.profiles) ? v.profiles[0] ?? null : v.profiles,
    })) || [];
  }, []);

  // React to status
  const reactToStatus = useCallback(async (statusId: string, reactionType: string) => {
    if (!user) return;

    // Check if user already reacted
    const { data: existing } = await supabase
      .from('status_reactions')
      .select('id, reaction_type')
      .eq('status_id', statusId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Remove reaction if same type
        await supabase
          .from('status_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        // Update to new reaction type
        await supabase
          .from('status_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);
      }
    } else {
      // Add new reaction
      await supabase
        .from('status_reactions')
        .insert({
          status_id: statusId,
          user_id: user.id,
          reaction_type: reactionType,
        });
    }
  }, [user]);

  // Get status reactions
  const getStatusReactions = useCallback(async (statusId: string) => {
    const { data } = await supabase
      .from('status_reactions')
      .select(`
        id,
        reaction_type,
        user_id,
        created_at,
        profiles:user_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('status_id', statusId);

    return data || [];
  }, []);

  // Get user's reaction to a status
  const getUserReaction = useCallback(async (statusId: string) => {
    if (!user) return null;

    const { data } = await supabase
      .from('status_reactions')
      .select('reaction_type')
      .eq('status_id', statusId)
      .eq('user_id', user.id)
      .single();

    return data?.reaction_type || null;
  }, [user]);

  // Mute/unmute contact status
  const toggleMuteContact = useCallback(async (contactId: string) => {
    if (!user) return;

    if (mutedContacts.includes(contactId)) {
      await supabase
        .from('muted_status_contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('muted_user_id', contactId);
      setMutedContacts(prev => prev.filter(id => id !== contactId));
    } else {
      await supabase
        .from('muted_status_contacts')
        .insert({
          user_id: user.id,
          muted_user_id: contactId,
        });
      setMutedContacts(prev => [...prev, contactId]);
    }

    await fetchContactStatuses();
  }, [user, mutedContacts, fetchContactStatuses]);

  // Get archived statuses
  const getArchivedStatuses = useCallback(async () => {
    if (!user) return [];

    const { data } = await supabase
      .from('statuses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', true)
      .order('created_at', { ascending: false });

    return data || [];
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchMyStatuses();
    fetchContactStatuses();
  }, [fetchMyStatuses, fetchContactStatuses]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`status-updates-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'statuses',
        },
        () => {
          fetchMyStatuses();
          fetchContactStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMyStatuses, fetchContactStatuses]);

  return {
    myStatuses,
    contactStatuses,
    mutedContacts,
    loading,
    createStatus,
    deleteStatus,
    archiveStatus,
    markAsViewed,
    replyToStatus,
    reactToStatus,
    getStatusViews,
    getStatusReactions,
    getUserReaction,
    toggleMuteContact,
    getArchivedStatuses,
    fetchMyStatuses,
    fetchContactStatuses,
  };
}
