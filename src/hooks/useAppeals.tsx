import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Appeal {
  id: string;
  user_id: string;
  strike_id: string | null;
  report_id: string | null;
  appeal_type: string;
  reason: string;
  evidence_text: string | null;
  evidence_url: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  user_profile?: { display_name: string; username: string; avatar_url: string | null };
  reviewer_profile?: { display_name: string; username: string; avatar_url: string | null };
}

export function useAppeals() {
  const { user } = useAuth();

  const fetchAppeals = useCallback(async (status?: string) => {
    let query = supabase
      .from('moderation_appeals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status as Enums<'appeal_status'>);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      const allIds = [...new Set([
        ...data.map(a => a.user_id),
        ...data.filter(a => a.reviewed_by).map(a => a.reviewed_by!),
      ])];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', allIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(a => ({
        ...a,
        user_profile: profileMap.get(a.user_id),
        reviewer_profile: a.reviewed_by ? profileMap.get(a.reviewed_by) : undefined,
      })) as Appeal[];
    }

    return (data || []) as Appeal[];
  }, []);

  const submitAppeal = useCallback(async (params: {
    appealType: string;
    reason: string;
    strikeId?: string;
    reportId?: string;
    evidenceText?: string;
    evidenceUrl?: string;
  }) => {
    if (!user) return;

    const { error } = await supabase.from('moderation_appeals').insert({
      user_id: user.id,
      appeal_type: params.appealType,
      reason: params.reason,
      strike_id: params.strikeId || null,
      report_id: params.reportId || null,
      evidence_text: params.evidenceText || null,
      evidence_url: params.evidenceUrl || null,
    });

    if (error) throw error;
    toast.success('Apelação submetida. Será revista em breve.');
  }, [user]);

  const reviewAppeal = useCallback(async (
    appealId: string,
    decision: 'approved' | 'rejected',
    note: string
  ) => {
    if (!user) return;

    const { data: appeal, error: fetchError } = await supabase
      .from('moderation_appeals')
      .select('*')
      .eq('id', appealId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('moderation_appeals')
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        resolution_note: note,
      })
      .eq('id', appealId);

    if (error) throw error;

    // If approved and has a strike, revoke the strike
    if (decision === 'approved' && appeal?.strike_id) {
      await supabase
        .from('user_strikes')
        .update({
          status: 'revoked',
          revoked_by: user.id,
          revoked_at: new Date().toISOString(),
          revoke_reason: `Apelação aprovada: ${note}`,
        })
        .eq('id', appeal.strike_id);
    }

    // Notify user of result
    await supabase.from('moderation_notifications').insert({
      user_id: appeal.user_id,
      notification_type: 'appeal_result',
      title: decision === 'approved' ? 'Apelação aprovada ✓' : 'Apelação rejeitada',
      message: note,
      related_appeal_id: appealId,
      action_url: '/settings',
    });

    toast.success(decision === 'approved' ? 'Apelação aprovada' : 'Apelação rejeitada');
  }, [user]);

  return {
    fetchAppeals,
    submitAppeal,
    reviewAppeal,
  };
}
