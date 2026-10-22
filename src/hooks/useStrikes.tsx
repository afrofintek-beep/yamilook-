import { updateModeratedProfile } from '@/lib/profile-moderation';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface PublicProfileLite {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface Strike {
  id: string;
  user_id: string;
  issued_by: string;
  report_id: string | null;
  violation_category: string;
  severity: number;
  reason: string;
  evidence_url: string | null;
  content_type: string | null;
  content_id: string | null;
  status: string;
  expires_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  user_profile?: { display_name: string; username: string; avatar_url: string | null };
  issuer_profile?: { display_name: string; username: string; avatar_url: string | null };
}

export interface StrikeThreshold {
  id: string;
  strike_count: number;
  action_type: string;
  description: string;
  is_active: boolean;
}

export const VIOLATION_LABELS: Record<string, string> = {
  hate_speech: 'Discurso de ódio',
  bullying: 'Bullying',
  harassment: 'Assédio',
  nudity: 'Nudez',
  sexual_content: 'Conteúdo sexual',
  violence: 'Violência',
  graphic_violence: 'Violência gráfica',
  spam: 'Spam',
  scam: 'Burla / Fraude',
  misinformation: 'Desinformação',
  impersonation: 'Personificação',
  intellectual_property: 'Propriedade intelectual',
  self_harm: 'Auto-mutilação',
  illegal_activity: 'Atividade ilegal',
  other: 'Outro',
};

export function useStrikes() {
  const { user } = useAuth();

  const fetchUserStrikes = useCallback(async (userId?: string) => {
    let query = supabase
      .from('user_strikes')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich with profiles
    if (data && data.length > 0) {
      const allIds = [...new Set([
        ...data.map(s => s.user_id),
        ...data.map(s => s.issued_by),
      ])];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', allIds);

      const profileMap = new Map<string, PublicProfileLite>(
        (profiles ?? [])
          .filter((p): p is typeof p & { id: string } => p.id !== null)
          .map(p => [p.id, { id: p.id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }])
      );

      return data.map(s => ({
        ...s,
        user_profile: profileMap.get(s.user_id),
        issuer_profile: profileMap.get(s.issued_by),
      })) as Strike[];
    }

    return (data || []) as Strike[];
  }, []);

  const getActiveStrikeCount = useCallback(async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('user_strikes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;
    return count || 0;
  }, []);

  const issueStrike = useCallback(async (params: {
    userId: string;
    violationCategory: string;
    severity: number;
    reason: string;
    contentType?: string;
    contentId?: string;
    reportId?: string;
    evidenceUrl?: string;
  }) => {
    if (!user) return;

    const { error } = await supabase.from('user_strikes').insert({
      user_id: params.userId,
      issued_by: user.id,
      violation_category: params.violationCategory as Enums<'violation_category'>,
      severity: params.severity,
      reason: params.reason,
      content_type: params.contentType || null,
      content_id: params.contentId || null,
      report_id: params.reportId || null,
      evidence_url: params.evidenceUrl || null,
    });

    if (error) throw error;

    // Check threshold and auto-apply consequence
    const strikeCount = await getActiveStrikeCount(params.userId);
    const { data: threshold } = await supabase
      .from('strike_thresholds')
      .select('*')
      .eq('strike_count', strikeCount)
      .eq('is_active', true)
      .maybeSingle();

    if (threshold) {
      await applyThresholdAction(params.userId, threshold as StrikeThreshold, params.reason);
    }

    // Send notification to user
    await supabase.from('moderation_notifications').insert({
      user_id: params.userId,
      notification_type: 'strike_issued',
      title: `Strike ${strikeCount} — ${VIOLATION_LABELS[params.violationCategory] || params.violationCategory}`,
      message: params.reason,
      action_url: '/settings',
    });

    toast.success(`Strike #${strikeCount} aplicado`);
    return strikeCount;
  }, [user, getActiveStrikeCount]);

  const applyThresholdAction = useCallback(async (userId: string, threshold: StrikeThreshold, reason: string) => {
    const { action_type } = threshold;

    const durationMap: Record<string, number> = {
      suspend_24h: 24,
      suspend_7d: 168,
      suspend_30d: 720,
    };

    if (action_type === 'warning') {
      // Just notification, already sent above
      return;
    }

    if (action_type === 'ban') {
      await updateModeratedProfile(userId, {
        account_status: 'banned',
        suspension_reason: `Auto-ban: ${reason} (5 strikes)`,
      });

      await supabase.from('moderation_notifications').insert({
        user_id: userId,
        notification_type: 'suspension',
        title: 'Conta banida',
        message: 'A tua conta foi permanentemente banida devido a violações repetidas das normas da comunidade.',
        action_url: '/settings',
      });
      return;
    }

    const hours = durationMap[action_type];
    if (hours) {
      const suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await updateModeratedProfile(userId, {
        suspended_until: suspendedUntil,
        suspension_reason: `Auto-suspensão: ${reason}`,
        account_status: 'suspended',
      });

      await supabase.from('moderation_notifications').insert({
        user_id: userId,
        notification_type: 'suspension',
        title: `Conta suspensa (${threshold.description})`,
        message: `A tua conta foi suspensa automaticamente. Podes apelar desta decisão.`,
        action_url: '/settings',
      });
    }
  }, []);

  const revokeStrike = useCallback(async (strikeId: string, reason: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_strikes')
      .update({
        status: 'revoked',
        revoked_by: user.id,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq('id', strikeId);

    if (error) throw error;
    toast.success('Strike revogado');
  }, [user]);

  const fetchThresholds = useCallback(async () => {
    const { data, error } = await supabase
      .from('strike_thresholds')
      .select('*')
      .order('strike_count', { ascending: true });

    if (error) throw error;
    return (data || []) as StrikeThreshold[];
  }, []);

  return {
    fetchUserStrikes,
    getActiveStrikeCount,
    issueStrike,
    revokeStrike,
    fetchThresholds,
  };
}
