import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AccessGroup, FeaturePolicy, Mode } from './api';
import type { AccessDashboardCopy } from './copy';
import { featureLabel } from './labels';
import { fromLuandaInput, toLuandaInput } from './time';

export type PolicyDraft = Omit<FeaturePolicy, 'startsAt' | 'endsAt' | 'criteria'> & {
  start: string;
  end: string;
  criteria: { role: FeaturePolicy['criteria']['role']; groupIds: string[]; minAge: string };
};

export function policyDraft(policy: FeaturePolicy): PolicyDraft {
  return { ...policy, start: toLuandaInput(policy.startsAt), end: toLuandaInput(policy.endsAt), criteria: {
    role: policy.criteria.role, groupIds: [...policy.criteria.groupIds], minAge: String(policy.criteria.minAccountAgeDays),
  } };
}

export function draftPolicy(draft: PolicyDraft): FeaturePolicy {
  const minAge = Number(draft.criteria.minAge);
  if (!draft.criteria.minAge.trim() || !Number.isInteger(minAge) || minAge < 0 || minAge > 36500) throw new Error('invalidAge');
  if (draft.mode === 'criteria' && draft.criteria.role === 'any' && draft.criteria.groupIds.length === 0 && minAge === 0) throw new Error('emptyCriteriaError');
  let startsAt: string | null;
  let endsAt: string | null;
  try {
    startsAt = fromLuandaInput(draft.start);
    endsAt = fromLuandaInput(draft.end);
  } catch { throw new Error('invalidSchedule'); }
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('invalidSchedule');
  return {
    feature: draft.feature, mode: draft.mode, enabled: draft.enabled, startsAt, endsAt,
    criteria: { role: draft.criteria.role, groupIds: [...draft.criteria.groupIds], minAccountAgeDays: minAge },
    revision: draft.revision, updatedAt: draft.updatedAt,
  };
}

export function PolicyEditor({ policy, groups, busy, saving = false, copy, onSave }: {
  policy: FeaturePolicy;
  groups: AccessGroup[];
  busy: boolean;
  saving?: boolean;
  copy: AccessDashboardCopy;
  onSave: (policy: FeaturePolicy) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() => policyDraft(policy));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<'invalidAge' | 'emptyCriteriaError' | 'invalidSchedule' | null>(null);
  useEffect(() => { if (!dirty) setDraft(policyDraft(policy)); }, [policy, dirty]);
  const serverChanged = draft.revision !== policy.revision;
  const edit = (update: Partial<PolicyDraft>) => { setDraft(current => ({ ...current, ...update })); setDirty(true); setError(null); };
  const editCriteria = (update: Partial<PolicyDraft['criteria']>) => edit({ criteria: { ...draft.criteria, ...update } });
  const save = async () => {
    if (busy || serverChanged) return;
    let proposed: FeaturePolicy;
    try { proposed = draftPolicy(draft); }
    catch (failure) { setError((failure as Error).message as typeof error); return; }
    if (await onSave(proposed)) setDirty(false);
  };
  return <form className="space-y-5 rounded-xl border bg-card p-4 md:p-6" aria-label={featureLabel(policy.feature, copy)} onSubmit={event => { event.preventDefault(); void save(); }}>
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-xl font-semibold">{featureLabel(policy.feature, copy)}</h2>{dirty && <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{copy.reviewDraft}</span>}</div>
    {policy.feature === 'wallet' && <p className="text-sm text-muted-foreground">{copy.walletHint}</p>}
    {policy.feature === 'business_registration' && <p className="text-sm text-muted-foreground">{copy.businessHint}</p>}
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3"><span className="font-medium">{draft.enabled ? copy.enabled : copy.paused}</span><Switch aria-label={copy.enabled} checked={draft.enabled} disabled={busy} onCheckedChange={enabled => edit({ enabled })} /></label>
    <label className="grid gap-2 text-sm font-medium">{copy.mode}
      <select className="min-h-11 w-full rounded-md border bg-background px-3 text-base" value={draft.mode} disabled={busy} onChange={event => edit({ mode: event.target.value as Mode })}>
        <option value="admins">{copy.modeAdmins}</option><option value="selected">{copy.modeSelected}</option><option value="criteria">{copy.modeCriteria}</option><option value="all">{copy.modeAll}</option>
      </select>
    </label>
    {draft.mode === 'selected' && <p className="text-sm text-muted-foreground">{copy.selectedHint}</p>}
    {draft.mode === 'all' && <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{copy.allWarning}</p>}
    {draft.mode === 'criteria' && <fieldset className="space-y-4 rounded-lg border p-3" disabled={busy}>
      <legend className="px-1 text-sm font-medium">{copy.modeCriteria}</legend><p className="text-sm text-muted-foreground">{copy.criteriaHint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">{copy.role}<select className="min-h-11 rounded-md border bg-background px-3 text-base" value={draft.criteria.role} onChange={event => editCriteria({ role: event.target.value as FeaturePolicy['criteria']['role'] })}><option value="any">{copy.roleAny}</option><option value="moderator">{copy.roleModerator}</option><option value="user">{copy.roleUser}</option></select></label>
        <label className="grid gap-2 text-sm font-medium">{copy.minimumAge} ({copy.days})<Input type="number" min={0} max={36500} step={1} value={draft.criteria.minAge} onChange={event => editCriteria({ minAge: event.target.value })} /></label>
      </div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">{copy.groupCriteria}</legend>
        {groups.length === 0 && <p className="text-sm text-muted-foreground">{copy.noGroups}</p>}
        {groups.map(group => <label key={group.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.criteria.groupIds.includes(group.id)} onChange={event => editCriteria({ groupIds: event.target.checked ? [...draft.criteria.groupIds, group.id] : draft.criteria.groupIds.filter(id => id !== group.id) })} />{group.name}</label>)}
        <p className="text-sm text-muted-foreground">{copy.anyGroupHint}</p>
      </fieldset>
    </fieldset>}
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
      <label className="grid gap-2 text-sm font-medium">{copy.startsAt}<Input type="datetime-local" value={draft.start} onChange={event => edit({ start: event.target.value })} /></label>
      <label className="grid gap-2 text-sm font-medium">{copy.endsAt}<Input type="datetime-local" value={draft.end} onChange={event => edit({ end: event.target.value })} /></label>
      <p className="text-sm text-muted-foreground sm:col-span-2">{copy.luandaTime} · {copy.optionalTime}</p>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{copy[error]}</p>}
    {serverChanged && <p role="alert" className="text-sm text-destructive">{copy.conflict}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !dirty || serverChanged}>{saving ? copy.saving : copy.save}</Button><Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => { setDraft(policyDraft(policy)); setDirty(false); setError(null); }}>{copy.discard}</Button></div>
  </form>;
}
