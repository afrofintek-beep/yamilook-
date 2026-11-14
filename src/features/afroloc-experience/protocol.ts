export const AFROLOC_ORIGIN = 'https://app.afroloc.ao';
export const AFROLOC_EXPERIENCE_URL = `${AFROLOC_ORIGIN}/experiencia/yamilook/`;
export const actions = new Set(['catalog', 'list', 'create', 'close', 'position', 'queue', 'review']);
export function parseExperienceRequest(value: unknown): { id: string; action: string; data: Record<string, unknown> } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.type !== 'yamilook-afroloc-request' || typeof v.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(v.id) || typeof v.action !== 'string' || !actions.has(v.action)) return null;
  if (!v.data || typeof v.data !== 'object' || Array.isArray(v.data)) return null;
  if (JSON.stringify(v.data).length > 6000) return null;
  return { id: v.id, action: v.action, data: v.data as Record<string, unknown> };
}
