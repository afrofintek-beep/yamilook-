import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useUiLocale } from '@/i18n/ui-copy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { listIntegrationGrants, setIntegrationGrant, type IntegrationFeature } from './api';
import { integrationAccessCopy } from './copy';

export type IntegrationProfile = {
  id: string;
  display_name: string;
  username: string;
  isAdmin: boolean;
};

type Props = {
  users: IntegrationProfile[];
  usersLoading?: boolean;
  usersError?: boolean;
  onRetryUsers: () => void;
};

export function IntegrationAccessManager({ users, usersLoading = false, usersError = false, onRetryUsers }: Props) {
  const copy = integrationAccessCopy(useUiLocale());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'saved' | 'error' | null>(null);
  const lock = useRef(false);
  const grants = useQuery({
    queryKey: ['integration-access-grants', user?.id, user?.last_sign_in_at],
    queryFn: listIntegrationGrants,
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    retry: false,
  });
  const candidates = useMemo(() => {
    const term = search.trim().replace(/^@/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    return users.filter(profile => `${profile.display_name} ${profile.username}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(term));
  }, [users, search]);
  const selected = users.find(profile => profile.id === selectedId);
  const grant = grants.data?.find(item => item.userId === selectedId);
  const ready = !!user && !usersLoading && !usersError && grants.isSuccess && grants.isFetchedAfterMount;

  async function change(feature: IntegrationFeature, enabled: boolean) {
    if (lock.current || !ready || !selected || selected.isAdmin) return;
    lock.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await setIntegrationGrant(selected.id, feature, enabled);
      await Promise.all([
        grants.refetch({ throwOnError: true }),
        queryClient.invalidateQueries({ queryKey: ['integration-access'] }),
      ]);
      setMessage('saved');
    } catch {
      setMessage('error');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return <section className="rounded-xl border bg-card p-4 space-y-4" aria-label={copy.title}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <Button variant="outline" disabled={saving || grants.isFetching} onClick={() => { setMessage(null); void grants.refetch(); }}>{copy.refresh}</Button>
    </div>
    <p className="text-sm">{copy.description}</p>
    <p className="text-sm text-muted-foreground">{copy.adminHint}</p>
    {usersError && <div role="alert" className="space-y-2"><p>{copy.profilesError}</p><Button variant="outline" onClick={onRetryUsers}>{copy.retry}</Button></div>}
    {grants.isError && <div role="alert" className="space-y-2"><p>{copy.listError}</p><Button variant="outline" onClick={() => void grants.refetch()}>{copy.retry}</Button></div>}
    {(usersLoading || grants.isPending) && <p role="status">{copy.loading}</p>}
    <label className="grid gap-2 text-sm font-medium">{copy.search}
      <Input value={search} disabled={saving || usersLoading || usersError} onChange={event => setSearch(event.target.value)} />
    </label>
    {!usersLoading && !usersError && <label className="grid gap-2 text-sm font-medium">{copy.choose}
      <select className="min-h-11 w-full rounded-md border bg-background px-3 text-base" value={selectedId} disabled={saving} onChange={event => { setSelectedId(event.target.value); setMessage(null); }}>
        <option value="">{copy.choose}</option>
        {selected && !candidates.some(profile => profile.id === selected.id) && <option value={selected.id}>{selected.display_name || selected.username} · @{selected.username.replace(/^@+/, '')}</option>}
        {candidates.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || profile.username} · @{profile.username.replace(/^@+/, '')}</option>)}
      </select>
    </label>}
    {!usersLoading && !usersError && candidates.length === 0 && <p className="text-sm">{copy.noResults}</p>}
    {selected && ready && <fieldset className="rounded-lg border p-3 space-y-3" disabled={saving || selected.isAdmin}>
      <legend className="px-1 text-sm font-medium">{copy.selected}: {selected.display_name || selected.username}</legend>
      {selected.isAdmin && <p className="text-sm">{copy.adminAutomatic}</p>}
      {([
        ['google_maps', 'Google Maps', selected.isAdmin || grant?.googleMaps === true],
        ['maguela', 'MAGUELA', selected.isAdmin || grant?.maguela === true],
      ] as const).map(([feature, label, checked]) => <label key={feature} className="flex min-h-11 items-center justify-between gap-3">
        <span><span className="block font-medium">{label}</span><span className="block text-sm text-muted-foreground">{checked ? copy.visible : copy.hidden}</span></span>
        <Switch aria-label={label} checked={checked} disabled={saving || selected.isAdmin} onCheckedChange={enabled => void change(feature, enabled)} />
      </label>)}
    </fieldset>}
    {saving && <p role="status" className="text-sm">{copy.saving}</p>}
    {!saving && message && <p role={message === 'error' ? 'alert' : 'status'} className="text-sm">{message === 'error' ? copy.saveError : copy.saved}</p>}
  </section>;
}
