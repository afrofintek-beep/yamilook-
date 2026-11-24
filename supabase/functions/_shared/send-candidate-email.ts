import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.90.1';
import { candidateInvitationEmail } from './invitation-copy.ts';

export async function sendCandidateEmail(client: SupabaseClient, candidateId: string, language: unknown, reply: (data: unknown, status?: number) => Response) {
  // Recipient and code are always resolved on the server, never accepted from the caller.
  const { data: candidate, error } = await client.from('mvp_candidates')
    .select('id, reviewed_at, full_name, email, access_code, invite_sent_at, business_invitation_drafts(language)').eq('id', candidateId)
    .eq('status', 'approved').eq('code_used', false).single();
  if (error || !candidate?.access_code) return reply({ error: 'candidate_unavailable' }, 404);
  if (candidate.invite_sent_at && Date.now() - Date.parse(candidate.invite_sent_at) < 86400000)
    return reply({ accepted: true, alreadySent: true });
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('YAMILOOK_INVITE_EMAIL_FROM');
  if (!apiKey || !from) return reply({ error: 'email_not_configured' }, 503);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `mvp-${candidate.id}-${candidate.access_code}-${(candidate.invite_sent_at ? new Date() : new Date(candidate.reviewed_at ?? Date.now())).toISOString().slice(0,10)}` },
    body: JSON.stringify({ from, to: [candidate.email], ...candidateInvitationEmail(candidate.full_name, candidate.access_code, candidate.business_invitation_drafts?.[0]?.language ?? language, Boolean(candidate.business_invitation_drafts?.length)) }),
  });
  if (!response.ok) return reply({ error: 'email_delivery_failed' }, 502);
  const { error: saveError } = await client.from('mvp_candidates').update({ invite_sent_at: new Date().toISOString() }).eq('id', candidate.id);
  return saveError ? reply({ error: 'tracking_failed' }, 503) : reply({ accepted: true, trackingSaved: true });
}
