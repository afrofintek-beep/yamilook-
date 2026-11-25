import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchProfiles, type ProfileOption } from './api';
import type { AccessDashboardCopy } from './copy';

export function ProfilePicker({ value, onChange, disabled, copy }: {
  value: ProfileOption | null;
  onChange: (profile: ProfileOption | null) => void;
  disabled: boolean;
  copy: AccessDashboardCopy;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const canSearch = debounced.length === 0 || debounced.length >= 2;
  const profiles = useQuery({
    queryKey: ['access-dashboard-profiles', user?.id, user?.last_sign_in_at, debounced],
    queryFn: () => searchProfiles(debounced),
    enabled: !!user && canSearch,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
  });
  const rows = profiles.isSuccess ? profiles.data : [];
  const options = value && !rows.some(profile => profile.id === value.id) ? [value, ...rows] : rows;
  return <div className="space-y-3">
    <label className="grid gap-2 text-sm font-medium">{copy.searchProfiles}
      <Input value={search} disabled={disabled} maxLength={100} onChange={event => setSearch(event.target.value)} />
    </label>
    <p className="text-sm text-muted-foreground">{copy.searchHint}</p>
    {canSearch && profiles.isPending && <p role="status" className="text-sm">{copy.loading}</p>}
    {profiles.isError && <div role="alert" className="space-y-2 text-sm"><p>{copy.profilesError}</p><Button variant="outline" disabled={disabled} onClick={() => void profiles.refetch()}>{copy.retry}</Button></div>}
    <label className="grid gap-2 text-sm font-medium">{copy.selectProfile}
      <select className="min-h-11 w-full rounded-md border bg-background px-3 text-base" value={value?.id || ''} disabled={disabled} onChange={event => onChange(options.find(profile => profile.id === event.target.value) || null)}>
        <option value="">{copy.selectProfile}</option>
        {options.map(profile => <option key={profile.id} value={profile.id}>{profile.displayName || profile.username} · @{profile.username.replace(/^@+/, '')}</option>)}
      </select>
    </label>
    {canSearch && profiles.isSuccess && rows.length === 0 && <p className="text-sm">{copy.noProfiles}</p>}
  </div>;
}
