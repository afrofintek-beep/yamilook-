import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Only read fields already exposed by the public_profiles view. Never cache
// private profiles, authentication data, or public profiles across batches.
type PublicProfileRow = Database['public']['Views']['public_profiles']['Row'];
export type BatchedPublicProfile = Pick<PublicProfileRow,
  'id' | 'display_name' | 'username' | 'avatar_url' | 'bio' |
  'is_online' | 'last_seen' | 'status_message' |
  'show_online_status' | 'show_last_seen'
>;

export type PublicProfilesResult = {
  data: BatchedPublicProfile[] | null;
  error: Error | null;
};

const PROFILE_FIELDS =
  'id, display_name, username, avatar_url, bio, is_online, last_seen, status_message, show_online_status, show_last_seen';
// Bound each in() URL, even when many components request profiles together.
const MAX_IDS_PER_QUERY = 80;

type PendingRead = {
  ids: string[];
  resolve: (result: PublicProfilesResult) => void;
};

let pending: PendingRead[] = [];
let flushScheduled = false;

/**
 * Merge profile lookups fired during the same event-loop turn.
 * - No time-based caching: presence/identity changes are read afresh.
 * - A caller receives ONLY the profiles it requested.
 * - The Supabase public_profiles view remains the authorization boundary.
 * - On failure every waiter receives the error instead of stale/partial data.
 */
export function fetchPublicProfilesBatched(ids: readonly string[]): Promise<PublicProfilesResult> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (uniqueIds.length === 0) return Promise.resolve({ data: [], error: null });

  return new Promise(resolve => {
    pending.push({ ids: uniqueIds, resolve });
    if (flushScheduled) return;
    flushScheduled = true;
    // React sibling effects can request the same profiles before this microtask.
    void Promise.resolve().then(flush);
  });
}

export async function fetchPublicProfileById(id: string) {
  const result = await fetchPublicProfilesBatched([id]);
  return { data: result.data?.find(profile => profile.id === id) ?? null, error: result.error };
}

async function flush() {
  const jobs = pending;
  pending = [];
  flushScheduled = false;

  const ids = [...new Set(jobs.flatMap(job => job.ids))];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_QUERY) {
    chunks.push(ids.slice(i, i + MAX_IDS_PER_QUERY));
  }

  try {
    const responses = await Promise.all(chunks.map(chunk =>
      supabase.from('public_profiles').select(PROFILE_FIELDS).in('id', chunk)
    ));
    const failure = responses.find(response => response.error)?.error;
    if (failure) {
      jobs.forEach(job => job.resolve({ data: null, error: failure }));
      return;
    }

    const rows = new Map<string, BatchedPublicProfile>();
    for (const response of responses) {
      for (const profile of response.data ?? []) {
        if (profile.id) rows.set(profile.id, profile);
      }
    }
    jobs.forEach(job => job.resolve({
      data: job.ids.flatMap(id => {
        const profile = rows.get(id);
        return profile ? [profile] : [];
      }),
      error: null,
    }));
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Public profile request failed');
    jobs.forEach(job => job.resolve({ data: null, error }));
  }
}
