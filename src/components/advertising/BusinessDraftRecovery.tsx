import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { businessInvitationCopy } from '@/lib/business-invitation-copy';
import type { readEntry } from '@/lib/business-entry';

type Draft = ReturnType<typeof readEntry>;

export function BusinessDraftRecovery({ children }: { children: (draft?: Draft) => ReactNode }) {
  const { i18n } = useTranslation();
  const labels = businessInvitationCopy(i18n.language);
  const [drafts, setDrafts] = useState<Draft[]>();
  const [chosen, setChosen] = useState<Draft>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.rpc('my_business_invitation_drafts');
        if (error) throw error;
        if (active) setDrafts((data ?? []).map(d => ({ name: d.name, activity: d.activity, scene: d.scene, planned: d.planned, year: String(d.start_year ?? '') })));
      } catch { if (active) setError(true); }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);
  if (error) return <Button onClick={() => { setError(false); setAttempt(attempt + 1); }}>{labels.retry}</Button>;
  if (!drafts) return <p role="status">…</p>;
  if (chosen || !drafts.length) return <>{children(chosen)}</>;
  return <section className="space-y-2"><h2>{labels.resume}</h2>
    {drafts.map(d => <Button key={d.name} variant="outline" onClick={() => setChosen(d)}>{d.name}</Button>)}
  </section>;
}
