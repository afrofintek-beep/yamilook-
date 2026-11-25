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
    const timer = setTimeout(() => setDebounced(search.trim().replace(/^@+/, '').trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const normalized = search.trim().replace(/^@+/, '').trim();
  const canSearch = debounced.length === 0 || debounced.length >= 2;
  const settling = normalized !== debounced;
  const profiles = useQuery({
    queryKey: ['access-dashboard-profiles', user?.id, user?.last_sign_in_at, debounced],
    queryFn: () => searchProfiles(debounced),
    enabled: !!user && canSearch,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: 'always',
  });
  const rows = !settling && profiles.isSuccess ? profiles.data : [];
  return <div className="space-y-3">
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
      event.preventDefault();
      if (normalized.length === 1 || disabled) return;
      if (settling) setDebounced(normalized); else void profiles.refetch();
    }}>
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">{copy.searchProfiles}
        <Input value={search} disabled={disabled} maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={event => { setSearch(event.target.value); onChange(null); }} />
      </label>
      <Button type="submit" variant="outline" disabled={disabled || normalized.length === 1 || profiles.isFetching}>{copy.refresh}</Button>
    </form>
    {normalized.length < 2 && <p className="text-sm text-muted-foreground">{copy.searchHint}</p>}
    {(settling || (canSearch && profiles.isPending)) && <p role="status" className="text-sm">{copy.loading}</p>}
    {profiles.isError && !settling && <div role="alert" className="space-y-2 text-sm"><p>{copy.profilesError}</p><Button variant="outline" disabled={disabled} onClick={() => void profiles.refetch()}>{copy.retry}</Button></div>}
    <div role="group" aria-label={copy.selectProfile} aria-busy={settling || profiles.isFetching} className="space-y-2">
      <p className="text-sm font-medium">{copy.selectProfile}</p>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {rows.map(profile => <button key={profile.id} type="button" disabled={disabled}
          aria-pressed={value?.id === profile.id}
          aria-label={`${profile.displayName || profile.username} @${profile.username.replace(/^@+/, '')}`}
          className={`min-h-14 w-full rounded-lg border p-3 text-start disabled:opacity-50 ${value?.id === profile.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-background hover:bg-muted'}`}
          onClick={() => onChange(profile)}>
          <span className="block break-words font-medium">{profile.displayName || profile.username}</span>
          <span dir="ltr" className="block break-all text-sm text-muted-foreground">@{profile.username.replace(/^@+/, '')}</span>
        </button>)}
      </div>
    </div>
    {!settling && canSearch && profiles.isSuccess && rows.length === 0 && <p className="text-sm">{copy.noProfiles}</p>}
  </div>;
}
