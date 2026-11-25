import { adminAreaKeys } from '@/features/admin-areas/catalog';
import { supabase } from '@/integrations/supabase/client';

export const featureKeys = ['google_maps', 'maguela', 'wallet', 'business_registration', ...adminAreaKeys] as const;
export type FeatureKey = typeof featureKeys[number];
export type Mode = 'admins' | 'selected' | 'criteria' | 'all';
export type Criteria = { role: 'any' | 'moderator' | 'user'; groupIds: string[]; minAccountAgeDays: number };
export type FeaturePolicy = { feature: FeatureKey; mode: Mode; enabled: boolean; startsAt: string | null; endsAt: string | null; criteria: Criteria; revision: number; updatedAt: string };
export type ProfileOverride = { feature: FeatureKey; userId: string; effect: 'allow' | 'deny'; expiresAt: string | null; note: string; username: string; displayName: string };
export type AccessGroup = { id: string; name: string; members: { userId: string; username: string; displayName: string }[] };
export type AuditEntry = {
  id: string; feature: FeatureKey | null; action: string; actorName: string; targetName: string | null; createdAt: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
};
export type DashboardData = { policies: FeaturePolicy[]; overrides: ProfileOverride[]; groups: AccessGroup[]; audit: AuditEntry[] };
export type ProfileOption = { id: string; username: string; displayName: string; isAdmin: boolean; isModerator: boolean; createdAt: string };
export type AccessDecision = { feature: FeatureKey; allowed: boolean; reason: string };

export class AccessDashboardError extends Error {
  constructor(readonly code: 'conflict' | 'invalid' | 'forbidden' | 'unavailable') { super(code); }
}
async function request(action: string, data: Record<string, unknown> = {}): Promise<unknown> {
  const result = await supabase.rpc('access_dashboard_manage_v2' as never, { p_action: action, p_data: data } as never);
  if (result.error) {
    const code = result.error.code;
    throw new AccessDashboardError(code === '40001' ? 'conflict' : code === '42501' || code === '28000' ? 'forbidden' : code?.startsWith('22') || code === '23505' ? 'invalid' : 'unavailable');
  }
  return result.data;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const feature = (v: unknown): v is FeatureKey => featureKeys.includes(v as FeatureKey);
const text = (v: unknown): v is string => typeof v === 'string';
const nullableDate = (v: unknown) => v === null || (text(v) && Number.isFinite(Date.parse(v)));
const validPolicy = (v: unknown): v is FeaturePolicy => record(v) && feature(v.feature)
  && ['admins', 'selected', 'criteria', 'all'].includes(v.mode as string) && typeof v.enabled === 'boolean'
  && nullableDate(v.startsAt) && nullableDate(v.endsAt) && Number.isInteger(v.revision) && Number(v.revision) > 0
  && text(v.updatedAt) && record(v.criteria) && ['any', 'moderator', 'user'].includes(v.criteria.role as string)
  && Array.isArray(v.criteria.groupIds) && v.criteria.groupIds.every(text) && Number.isInteger(v.criteria.minAccountAgeDays);
async function mutate(action: string, data: Record<string, unknown>): Promise<void> {
  const result = await request(action, data);
  if (!record(result) || result.ok !== true) throw new AccessDashboardError('unavailable');
}
export async function loadDashboard(): Promise<DashboardData> {
  const data = await request('dashboard');
  if (!record(data) || !Array.isArray(data.policies) || !data.policies.every(validPolicy)
    || data.policies.length !== featureKeys.length || new Set(data.policies.map(p => p.feature)).size !== featureKeys.length
    || !Array.isArray(data.overrides) || !data.overrides.every(o => record(o) && feature(o.feature) && text(o.userId)
      && ['allow', 'deny'].includes(o.effect as string) && nullableDate(o.expiresAt) && text(o.note) && text(o.username) && text(o.displayName))
    || !Array.isArray(data.groups) || !data.groups.every(g => record(g) && text(g.id) && text(g.name) && Array.isArray(g.members)
      && g.members.every(m => record(m) && text(m.userId) && text(m.username) && text(m.displayName)))
    || !Array.isArray(data.audit) || !data.audit.every(a => record(a) && text(a.id) && (a.feature === null || feature(a.feature))
      && text(a.action) && text(a.actorName) && (a.targetName === null || text(a.targetName)) && text(a.createdAt)
      && (a.before === null || record(a.before)) && (a.after === null || record(a.after)))) {
    throw new AccessDashboardError('unavailable');
  }
  return data as DashboardData;
}
export async function searchProfiles(query: string): Promise<ProfileOption[]> {
  const data = await request('search_profiles', { query });
  if (!Array.isArray(data) || !data.every(p => record(p) && text(p.id) && text(p.username) && text(p.displayName)
    && typeof p.isAdmin === 'boolean' && typeof p.isModerator === 'boolean' && text(p.createdAt))) throw new AccessDashboardError('unavailable');
  return data as ProfileOption[];
}
export async function savePolicy(policy: FeaturePolicy): Promise<void> {
  const { feature, mode, enabled, startsAt, endsAt, criteria, revision } = policy;
  return mutate('save_policy', { feature, mode, enabled, startsAt, endsAt, criteria, revision });
}
export async function setOverride(feature: FeatureKey, userId: string, effect: 'allow' | 'deny' | 'inherit', expiresAt: string | null, note: string): Promise<void> {
  return mutate('set_override', { feature, userId, effect, expiresAt, note });
}
export async function createAccessGroup(name: string): Promise<void> { return mutate('create_group', { name }); }
export async function setGroupMember(groupId: string, userId: string, included: boolean): Promise<void> {
  return mutate('set_group_member', { groupId, userId, included });
}
export async function previewAccess(userId: string): Promise<AccessDecision[]> {
  const data = await request('preview', { userId });
  if (!Array.isArray(data) || data.length !== featureKeys.length || new Set(data.map(d => d?.feature)).size !== featureKeys.length
    || !data.every(d => record(d) && feature(d.feature) && typeof d.allowed === 'boolean' && text(d.reason))) throw new AccessDashboardError('unavailable');
  return data as AccessDecision[];
}
