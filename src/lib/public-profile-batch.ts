import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Only read fields already exposed by the public_profiles view. Never cache
// private profiles, authentication data, or public profiles across requests.
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
const MAX_IDS_PER_QUERY = 80;

type SingleResult = { data: BatchedPublicProfile | null; error: Error | null };
type ResolveOne = (result: SingleResult) => void;

// These maps hold only unresolved reads. On completion (success or failure),
// they are cleared: no stale profile data is retained between fetches.
const pending = new Map<string, ResolveOne>();
const inFlight = new Map<string, Promise<SingleResult>>();
let flushScheduled = false;

function queueProfile(id: string): Promise<SingleResult> {
  const existing = inFlight.get(id);
  if (existing) return existing;

  let resolveOne!: ResolveOne;
  const request = new Promise<SingleResult>(resolve => { resolveOne = resolve; });
  inFlight.set(id, request);
  pending.set(id, resolveOne);

  if (!flushScheduled) {
    flushScheduled = true;
    // Merge reads from sibling effects before dispatching network requests.
    void Promise.resolve().then(flush);
  }
  return request;
}

/**
 * Batch concurrent lookups by profile ID. Distinct callers receive only their
 * requested IDs; overlapping reads share even an already in-flight request.
 * A completed read is never cached, preserving fresh presence information.
 * The public_profiles view remains the authorization boundary.
 */
export async function fetchPublicProfilesBatched(ids: readonly string[]): Promise<PublicProfilesResult> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (!uniqueIds.length) return { data: [], error: null };

  const results = await Promise.all(uniqueIds.map(queueProfile));
  const failure = results.find(result => result.error)?.error;
  if (failure) return { data: null, error: failure };
  return { data: results.flatMap(result => result.data ? [result.data] : []), error: null };
}

export async function fetchPublicProfileById(id: string) {
  const result = await fetchPublicProfilesBatched([id]);
  return { data: result.data?.[0] ?? null, error: result.error };
}

async function flush() {
  const jobs = new Map(pending);
  pending.clear();
  flushScheduled = false;
  const ids = [...jobs.keys()];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_QUERY) {
    chunks.push(ids.slice(i, i + MAX_IDS_PER_QUERY));
  }

  const complete = (data: Map<string, BatchedPublicProfile> | null, error: Error | null) => {
    jobs.forEach((resolve, id) => {
      // Release only our own in-flight entry; never retain profile data.
      inFlight.delete(id);
      resolve({ data: data?.get(id) ?? null, error });
    });
  };

  try {
    const responses = await Promise.all(chunks.map(chunk =>
      supabase.from('public_profiles').select(PROFILE_FIELDS).in('id', chunk)
    ));
    const failure = responses.find(response => response.error)?.error;
    if (failure) {
      complete(null, failure);
      return;
    }

    const profiles = new Map<string, BatchedPublicProfile>();
    for (const response of responses) {
      for (const profile of response.data ?? []) {
        if (profile.id) profiles.set(profile.id, profile);
      }
    }
    complete(profiles, null);
  } catch (cause) {
    complete(null, cause instanceof Error ? cause : new Error('Public profile request failed'));
  }
}
