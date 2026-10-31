import { updateModeratedProfile } from '@/lib/profile-moderation';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Enums, Json } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface PublicProfileLite {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  category: string;
  description: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  reporter?: { display_name: string; username: string; avatar_url: string | null };
  target_preview?: string;
}

export interface ModerationAction {
  id: string;
  moderator_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  report_id: string | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  moderator?: { display_name: string; username: string; avatar_url: string | null };
}

export interface ModerationStats {
  pending_reports: number;
  resolved_today: number;
  total_actions: number;
  hidden_posts: number;
  suspended_users: number;
}

export function useModeration() {
  const { user } = useAuth();
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      if (!user) {
        setIsModerator(false);
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.rpc('is_moderator_or_admin', { p_user_id: user.id });
        setIsModerator(data === true);
      } catch {
        setIsModerator(false);
      } finally {
        setLoading(false);
      }
    }
    checkRole();
  }, [user]);

  const fetchReports = useCallback(async (status?: string) => {
    let query = supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq('status', status as 'pending' | 'reviewing' | 'resolved' | 'dismissed');
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with reporter info
    if (data && data.length > 0) {
      const reporterIds = [...new Set(data.map(r => r.reporter_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', reporterIds);

      const profileMap = new Map<string, PublicProfileLite>(
        (profiles ?? [])
          .filter((p): p is typeof p & { id: string } => p.id !== null)
          .map(p => [p.id, { id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }])
      );

      return data.map(r => ({
        ...r,
        reporter: profileMap.get(r.reporter_id),
      })) as ContentReport[];
    }

    return (data || []) as ContentReport[];
  }, []);

  const fetchStats = useCallback(async (): Promise<ModerationStats> => {
    const [pendingRes, todayRes, actionsRes, hiddenRes, suspendedRes] = await Promise.all([
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('content_reports').select('*', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .gte('resolved_at', new Date().toISOString().split('T')[0]),
      supabase.from('moderation_actions').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('suspended_until', 'is', null),
    ]);

    return {
      pending_reports: pendingRes.count || 0,
      resolved_today: todayRes.count || 0,
      total_actions: actionsRes.count || 0,
      hidden_posts: hiddenRes.count || 0,
      suspended_users: suspendedRes.count || 0,
    };
  }, []);

  const fetchAuditLog = useCallback(async (moderatorId?: string) => {
    let query = supabase
      .from('moderation_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (moderatorId) {
      query = query.eq('moderator_id', moderatorId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with moderator info
    if (data && data.length > 0) {
      const modIds = [...new Set(data.map(a => a.moderator_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', modIds);

      const profileMap = new Map<string, PublicProfileLite>(
        (profiles ?? [])
          .filter((p): p is typeof p & { id: string } => p.id !== null)
          .map(p => [p.id, { id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }])
      );

      return data.map(a => ({
        ...a,
        moderator: profileMap.get(a.moderator_id),
      })) as ModerationAction[];
    }

    return (data || []) as ModerationAction[];
  }, []);

  const logAction = useCallback(async (
    actionType: string,
    targetType: string,
    targetId: string,
    reason?: string,
    reportId?: string,
    details?: Json
  ) => {
    if (!user) return;

    const { error } = await supabase.from('moderation_actions').insert({
      moderator_id: user.id,
      action_type: actionType as Enums<'moderation_action_type'>,
      target_type: targetType,
      target_id: targetId,
      reason,
      report_id: reportId,
      details: details || null,
    });

    if (error) {
      console.error('Error logging moderation action:', error);
    }
  }, [user]);

  const resolveReport = useCallback(async (reportId: string, resolution: 'resolved' | 'dismissed', note?: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('content_reports')
      .update({
        status: resolution,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: note || null,
      })
      .eq('id', reportId);

    if (error) throw error;

    await logAction(
      resolution === 'resolved' ? 'resolve_report' : 'dismiss_report',
      'user', // generic
      reportId,
      note
    );

    toast.success(resolution === 'resolved' ? 'Denúncia resolvida' : 'Denúncia descartada');
  }, [user, logAction]);

  const hidePost = useCallback(async (postId: string, reason: string, reportId?: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('posts')
      .update({ is_hidden: true, hidden_reason: reason })
      .eq('id', postId);

    if (error) throw error;

    await logAction('hide_post', 'post', postId, reason, reportId);
    toast.success('Post ocultado');
  }, [user, logAction]);

  const unhidePost = useCallback(async (postId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('posts')
      .update({ is_hidden: false, hidden_reason: null })
      .eq('id', postId);

    if (error) throw error;

    await logAction('unhide_post', 'post', postId);
    toast.success('Post restaurado');
  }, [user, logAction]);

  const hideComment = useCallback(async (commentId: string, reason: string, reportId?: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('post_comments')
      .update({ is_hidden: true })
      .eq('id', commentId);

    if (error) throw error;

    await logAction('hide_comment', 'comment', commentId, reason, reportId);
    toast.success('Comentário ocultado');
  }, [user, logAction]);

  const suspendUser = useCallback(async (targetUserId: string, durationHours: number, reason: string, reportId?: string) => {
    if (!user) return;

    const suspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const { error } = await updateModeratedProfile(targetUserId, {
        suspended_until: suspendedUntil,
        suspension_reason: reason,
        account_status: 'suspended',
      });

    if (error) throw error;

    await logAction('suspend_user', 'user', targetUserId, reason, reportId, { duration_hours: durationHours });
    toast.success('Utilizador suspenso');
  }, [user, logAction]);

  const unsuspendUser = useCallback(async (targetUserId: string) => {
    if (!user) return;

    const { error } = await updateModeratedProfile(targetUserId, {
        suspended_until: null,
        suspension_reason: null,
        account_status: 'active',
      });

    if (error) throw error;

    await logAction('unsuspend_user', 'user', targetUserId);
    toast.success('Suspensão removida');
  }, [user, logAction]);

  const banUser = useCallback(async (targetUserId: string, reason: string, reportId?: string) => {
    if (!user) return;

    const { error } = await updateModeratedProfile(targetUserId, {
        account_status: 'banned',
        suspension_reason: reason,
      });

    if (error) throw error;

    await logAction('ban_user', 'user', targetUserId, reason, reportId);
    toast.success('Utilizador banido');
  }, [user, logAction]);

  const submitReport = useCallback(async (
    targetType: string,
    targetId: string,
    category: string,
    description?: string
  ) => {
    if (!user) return;

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      category: category as Enums<'report_category'>,
      description: description || null,
    });

    if (error) throw error;
    toast.success('Denúncia enviada. Obrigado por ajudar a manter a comunidade segura.');
  }, [user]);

  return {
    isModerator,
    loading,
    fetchReports,
    fetchStats,
    fetchAuditLog,
    resolveReport,
    hidePost,
    unhidePost,
    hideComment,
    suspendUser,
    unsuspendUser,
    banUser,
    submitReport,
  };
}
