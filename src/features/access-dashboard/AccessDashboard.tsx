import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIntegrationAccess } from '@/features/integration-access/useIntegrationAccess';
import { useUiLocale } from '@/i18n/ui-copy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  loadDashboard, savePolicy, setOverride, createAccessGroup, setGroupMember, previewAccess,
  type FeatureKey, type FeaturePolicy, type ProfileOption, type ProfileOverride, type AccessGroup,
} from './api';
import { accessDashboardCopy, type AccessDashboardCopy } from './copy';
import { featureLabel, accessReasonLabel, auditActionLabel } from './labels';
import { PolicyEditor } from './PolicyEditor';
import { ProfilePicker } from './ProfilePicker';
import { formatLuanda, fromLuandaInput, toLuandaInput } from './time';
import { adminAreaKeys } from '@/features/admin-areas/catalog';
import { AdminAreaLinks } from '@/features/admin-areas/AdminAreas';
import { HistoryDetails } from './HistoryDetails';

const FEATURE_KEYS: FeatureKey[] = ['google_maps', 'maguela', 'wallet', 'business_registration', ...adminAreaKeys];
type Mutate = (change: () => Promise<void>) => Promise<boolean>;

export default function AccessDashboard() {
  const locale = useUiLocale();
  const copy = accessDashboardCopy(locale);
  const access = useIntegrationAccess();
  const { user } = useAuth();
  if (!access.admin) return <main className="mx-auto min-h-screen max-w-xl space-y-4 px-4 py-8 safe-top"><h1 className="text-2xl font-semibold">{copy.title}</h1><p role={access.error ? 'alert' : 'status'}>{access.loading ? copy.checking : access.error ? copy.accessUnavailable : copy.deniedPage}</p>{access.error && <Button variant="outline" onClick={() => void access.retry()}>{copy.retry}</Button>}<Button asChild variant="outline"><Link to="/feed">{copy.backYamilook}</Link></Button></main>;
  return <Dashboard key={`${user?.id}:${user?.last_sign_in_at}`} locale={locale} copy={copy} />;
}

function Dashboard({ locale, copy }: { locale: string; copy: AccessDashboardCopy }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['access-dashboard', user?.id, user?.last_sign_in_at],
    queryFn: loadDashboard,
    staleTime: 0, gcTime: 0, retry: false,
    refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 30_000,
  });
  const [tab, setTab] = useState<'features' | 'people' | 'groups' | 'history'>('features');
  const [search, setSearch] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey>('google_maps');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'saveError' | 'conflict' | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const data = query.data;
  const available = query.isSuccess && query.isFetchedAfterMount;
  const busy = saving || !available;
  const mutate: Mutate = async change => {
    if (lock.current || !available) return false;
    lock.current = true; setSaving(true); setNotice(null);
    try {
      await change();
      if (!alive.current) return false;
      await query.refetch({ throwOnError: true });
      if (!alive.current) return false;
      await Promise.all([
        client.invalidateQueries({ queryKey: ['integration-access'] }),
        client.invalidateQueries({ queryKey: ['admin-area-access'] }),
        client.invalidateQueries({ queryKey: ['feature-access'] }),
        client.invalidateQueries({ queryKey: ['wallet-access'] }),
        client.invalidateQueries({ queryKey: ['access-dashboard-preview'] }),
      ]);
      if (!alive.current) return false;
      setNotice('saved'); return true;
    } catch (error) {
      if (alive.current) setNotice((error as { code?: string })?.code === 'conflict' || /conflict|revision|409/i.test((error as Error)?.message || '') ? 'conflict' : 'saveError');
      return false;
    } finally { lock.current = false; if (alive.current) setSaving(false); }
  };
  const searchTerm = search.trim().toLocaleLowerCase();
  const matches = data?.policies.filter(policy => featureLabel(policy.feature, copy).toLocaleLowerCase().includes(searchTerm)) || [];

  return <div className="min-h-screen bg-background pb-16">
    <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur safe-top">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><ShieldCheck aria-hidden className="h-6 w-6 shrink-0 text-primary" /><h1 className="text-xl font-semibold">{copy.title}</h1></div>
        <div className="flex flex-wrap gap-2"><Button asChild variant="ghost"><Link to="/admin">{copy.back}</Link></Button><Button variant="outline" disabled={saving || query.isFetching} onClick={() => { setNotice(null); void query.refetch(); }}><RefreshCw aria-hidden className="mr-2 h-4 w-4" />{copy.refresh}</Button></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="space-y-2"><p>{copy.description}</p><p className="text-sm text-muted-foreground">{copy.adminHint}</p></div>
      {query.isPending && <p role="status">{copy.loading}</p>}
      {query.isError && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4"><p>{copy.loadError}</p><Button variant="outline" onClick={() => void query.refetch()}>{copy.retry}</Button></div>}
      {notice && <div role={notice === 'saved' ? 'status' : 'alert'} className={`rounded-xl border p-3 text-sm ${notice === 'saved' ? 'border-primary/30' : 'border-destructive/30'}`}>{copy[notice]}</div>}
      {data && <>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [copy.policyCount, data.policies.filter(policy => policy.enabled).length], [copy.overrideCount, data.overrides.length],
            [copy.groupCount, data.groups.length], [copy.auditCount, data.audit.length],
          ].map(([label, count]) => <div key={label} className="rounded-xl border bg-card p-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-semibold">{count}</dd></div>)}
        </dl>
        <div role="tablist" aria-label={copy.title} className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-2 sm:grid-cols-4">
          {(['features', 'people', 'groups', 'history'] as const).map(value => <button key={value} id={`access-tab-${value}`} role="tab" type="button" aria-selected={tab === value} aria-controls={`access-panel-${value}`} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium ${tab === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} onClick={() => setTab(value)}>{copy[value]}</button>)}
        </div>
        <section id="access-panel-features" role="tabpanel" aria-labelledby="access-tab-features" hidden={tab !== 'features'} className="space-y-4">
          <label className="grid gap-2 text-sm font-medium">{copy.searchFeatures}<Input value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {matches.map(policy => <button key={policy.feature} type="button" aria-pressed={selectedFeature === policy.feature} className={`min-h-24 rounded-xl border bg-card p-4 text-start ${selectedFeature === policy.feature ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted'}`} onClick={() => setSelectedFeature(policy.feature)}>
              <span className="block font-semibold">{featureLabel(policy.feature, copy)}</span><span className="mt-2 block text-sm text-muted-foreground">{policy.enabled ? copy.enabled : copy.paused} · {copy[({ admins: 'modeAdmins', selected: 'modeSelected', criteria: 'modeCriteria', all: 'modeAll' } as const)[policy.mode]]}</span>
            </button>)}
          </div>
          {matches.length === 0 && <p className="text-sm text-muted-foreground">{copy.noFeatures}</p>}
          {data.policies.map(policy => <div key={policy.feature} hidden={selectedFeature !== policy.feature}><PolicyEditor policy={policy} groups={data.groups} busy={busy} saving={saving} copy={copy} onSave={proposed => mutate(() => savePolicy(proposed))} /></div>)}
        </section>
        <section id="access-panel-people" role="tabpanel" aria-labelledby="access-tab-people" hidden={tab !== 'people'}><PeoplePanel copy={copy} locale={locale} overrides={data.overrides} busy={busy} mutate={mutate} /></section>
        <section id="access-panel-groups" role="tabpanel" aria-labelledby="access-tab-groups" hidden={tab !== 'groups'}><GroupsPanel copy={copy} groups={data.groups} busy={busy} mutate={mutate} /></section>
        <section id="access-panel-history" role="tabpanel" aria-labelledby="access-tab-history" hidden={tab !== 'history'} className="space-y-3">
          <h2 className="text-xl font-semibold">{copy.history}</h2><p className="text-sm text-muted-foreground">{copy.luandaTime} · {copy.last100Hint}</p>
          {data.audit.length === 0 && <p>{copy.noHistory}</p>}
          {data.audit.map(entry => <article key={entry.id} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">{copy.date}</p><p className="text-sm">{formatLuanda(entry.createdAt, locale)}</p></div>
            <div><p className="text-xs text-muted-foreground">{copy.actor}</p><p className="break-words text-sm">{entry.actorName}</p></div>
            <div><p className="text-xs text-muted-foreground">{copy.action}</p><p className="text-sm">{auditActionLabel(entry.action, copy)}</p></div>
            <div><p className="text-xs text-muted-foreground">{copy.target}</p><p className="break-words text-sm">{entry.targetName || (entry.feature ? featureLabel(entry.feature, copy) : '—')}</p></div>
            <div className="sm:col-span-2 lg:col-span-4"><HistoryDetails entry={entry} groups={data.groups} locale={locale} copy={copy} /></div>
          </article>)}
        </section>
      </>}
      <AdminAreaLinks />
      <section className="space-y-3 border-t pt-6"><h2 className="text-xl font-semibold">{copy.otherManagers}</h2><p className="text-sm text-muted-foreground">{copy.managersHint}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [copy.mentors, '/admin/mentors'],
          [copy.services, '/servicos-do-bairro'], [copy.dangereux, '/app/dangereux/'],
        ].map(([label, href]) => <a key={href} href={href} aria-label={label} className="flex min-h-20 flex-col justify-center rounded-xl border bg-card p-4 hover:bg-muted"><span className="font-medium">{label}</span><span className="mt-1 text-sm text-muted-foreground">{copy.openManager}</span></a>)}
      </div></section>
    </main>
  </div>;
}

function PeoplePanel({ copy, locale, overrides, busy, mutate }: { copy: AccessDashboardCopy; locale: string; overrides: ProfileOverride[]; busy: boolean; mutate: Mutate }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileOption | null>(null);
  const [feature, setFeature] = useState<FeatureKey>('google_maps');
  const [previewRequested, setPreviewRequested] = useState(false);
  const preview = useQuery({
    queryKey: ['access-dashboard-preview', user?.id, user?.last_sign_in_at, profile?.id],
    queryFn: () => previewAccess(profile!.id),
    enabled: !!profile && previewRequested,
    retry: false, staleTime: 0, gcTime: 0,
  });
  const mine = overrides.filter(item => item.userId === profile?.id);
  return <div className="space-y-5 rounded-xl border bg-card p-4 md:p-6">
    <h2 className="text-xl font-semibold">{copy.individualExceptions}</h2><p className="text-sm text-muted-foreground">{copy.exceptionHint}</p>
    <ProfilePicker value={profile} onChange={next => { setProfile(next); setPreviewRequested(false); }} disabled={busy} copy={copy} />
    {profile && <>
      {profile.isAdmin && <p className="rounded-lg border p-3 text-sm">{copy.adminProfile}</p>}
      <label className="grid gap-2 text-sm font-medium">{copy.features}<select className="min-h-11 rounded-md border bg-background px-3 text-base" value={feature} disabled={busy} onChange={event => setFeature(event.target.value as FeatureKey)}>{FEATURE_KEYS.map(key => <option key={key} value={key}>{featureLabel(key, copy)}</option>)}</select></label>
      {feature === 'wallet' && <p className="rounded-lg border p-3 text-sm text-muted-foreground">{copy.walletHint}</p>}
      <OverrideEditor key={`${profile.id}:${feature}`} feature={feature} profile={profile} initial={mine.find(item => item.feature === feature)} busy={busy} copy={copy} mutate={mutate} />
      <div className="space-y-2">
        {mine.length === 0 && <p className="text-sm text-muted-foreground">{copy.noOverrides}</p>}
        {mine.map(item => <article key={item.feature} className="space-y-1 rounded-lg border p-3"><p className="font-medium">{featureLabel(item.feature, copy)} · {item.effect === 'allow' ? copy.effectAllow : copy.effectDeny}</p><p className="text-sm">{copy.expiresAt}: {item.expiresAt ? formatLuanda(item.expiresAt, locale) : copy.unlimited}</p>{item.note && <p className="break-words text-sm text-muted-foreground">{item.note}</p>}</article>)}
      </div>
      <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">{copy.previewTitle}</h3><Button variant="outline" disabled={busy || preview.isFetching} onClick={() => { if (previewRequested) void preview.refetch(); else setPreviewRequested(true); }}>{copy.preview}</Button>
        {previewRequested && preview.isPending && <p role="status">{copy.checking}</p>}
        {previewRequested && preview.isError && <p role="alert" className="text-sm">{copy.previewError}</p>}
        {previewRequested && preview.isSuccess && <div className="grid gap-3 sm:grid-cols-2">{preview.data.map(item => <div key={item.feature} className="rounded-lg border p-3"><p className="font-medium">{featureLabel(item.feature, copy)}</p><p className="mt-1 text-sm">{item.allowed ? copy.allowed : copy.denied}</p><p className="mt-1 text-sm text-muted-foreground">{copy.reason}: {accessReasonLabel(item.reason, copy)}</p></div>)}</div>}
      </div>
    </>}
  </div>;
}

function OverrideEditor({ feature, profile, initial, busy, copy, mutate }: { feature: FeatureKey; profile: ProfileOption; initial?: ProfileOverride; busy: boolean; copy: AccessDashboardCopy; mutate: Mutate }) {
  const [effect, setEffect] = useState<'allow' | 'deny' | 'inherit'>(initial?.effect || 'inherit');
  const [expires, setExpires] = useState(toLuandaInput(initial?.expiresAt || null));
  const [note, setNote] = useState(initial?.note || '');
  const [dirty, setDirty] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { if (!dirty) { setEffect(initial?.effect || 'inherit'); setExpires(toLuandaInput(initial?.expiresAt || null)); setNote(initial?.note || ''); } }, [initial, dirty]);
  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault(); if (busy || profile.isAdmin) return;
    let expiry: string | null;
    try { expiry = effect === 'inherit' ? null : fromLuandaInput(expires); } catch { setInvalid(true); return; }
    if (expiry && Date.parse(expiry) <= Date.now()) { setInvalid(true); return; }
    void mutate(() => setOverride(feature, profile.id, effect, expiry, note.trim())).then(ok => { if (ok) setDirty(false); });
  }}>
    <fieldset disabled={busy || profile.isAdmin} className="space-y-4">
      <label className="grid gap-2 text-sm font-medium">{copy.effect}<select className="min-h-11 rounded-md border bg-background px-3 text-base" value={effect} onChange={event => { setEffect(event.target.value as typeof effect); setDirty(true); setInvalid(false); }}><option value="inherit">{copy.effectInherit}</option><option value="allow">{copy.effectAllow}</option><option value="deny">{copy.effectDeny}</option></select></label>
      {effect !== 'inherit' && <label className="grid gap-2 text-sm font-medium">{copy.expiresAt}<Input type="datetime-local" value={expires} onChange={event => { setExpires(event.target.value); setDirty(true); setInvalid(false); }} /><span className="font-normal text-muted-foreground">{copy.luandaTime} · {copy.optionalTime}</span></label>}
      <label className="grid gap-2 text-sm font-medium">{copy.note}<Textarea value={note} maxLength={500} rows={3} onChange={event => { setNote(event.target.value); setDirty(true); }} /></label>
      {invalid && <p role="alert" className="text-sm text-destructive">{copy.invalidExpiry}</p>}
      <Button type="submit" disabled={busy || profile.isAdmin || !dirty}>{copy.apply}</Button>
    </fieldset>
  </form>;
}

function GroupsPanel({ copy, groups, busy, mutate }: { copy: AccessDashboardCopy; groups: AccessGroup[]; busy: boolean; mutate: Mutate }) {
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [profile, setProfile] = useState<ProfileOption | null>(null);
  const group = groups.find(item => item.id === groupId);
  return <div className="space-y-5 rounded-xl border bg-card p-4 md:p-6">
    <h2 className="text-xl font-semibold">{copy.groups}</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (!busy && name.trim()) void mutate(() => createAccessGroup(name.trim())).then(ok => { if (ok) setName(''); }); }}>
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">{copy.groupName}<Input value={name} maxLength={80} required disabled={busy} onChange={event => setName(event.target.value)} /></label><Button type="submit" disabled={busy || !name.trim()}>{copy.createGroup}</Button>
    </form>
    {groups.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noGroups}</p> : <label className="grid gap-2 text-sm font-medium">{copy.selectGroup}<select className="min-h-11 rounded-md border bg-background px-3 text-base" value={groupId} disabled={busy} onChange={event => { setGroupId(event.target.value); setProfile(null); }}><option value="">{copy.selectGroup}</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name} ({item.members.length})</option>)}</select></label>}
    {group && <div className="space-y-4 border-t pt-4"><h3 className="font-semibold">{group.name} · {copy.members}: {group.members.length}</h3>
      <ProfilePicker value={profile} onChange={setProfile} disabled={busy} copy={copy} />
      <Button disabled={busy || !profile || group.members.some(member => member.userId === profile.id)} onClick={() => { if (profile) void mutate(() => setGroupMember(group.id, profile.id, true)).then(ok => { if (ok) setProfile(null); }); }}>{copy.addMember}</Button>
      <div className="divide-y rounded-lg border">{group.members.map(member => <div key={member.userId} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{member.displayName || member.username}</p><p dir="ltr" className="break-all text-sm text-muted-foreground">@{member.username.replace(/^@+/, '')}</p></div><Button variant="outline" disabled={busy} onClick={() => void mutate(() => setGroupMember(group.id, member.userId, false))}>{copy.removeMember}</Button></div>)}</div>
    </div>}
  </div>;
}
