import type { AccessGroup, AuditEntry } from './api';
import type { AccessDashboardCopy } from './copy';
import { formatLuanda } from './time';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Show the saved values, without exposing internal keys or technical identifiers. */
function snapshotRows(value: Record<string, unknown> | null, groups: AccessGroup[], locale: string, copy: AccessDashboardCopy): [string, string][] {
  if (!value) return [];
  const rows: [string, string][] = [];
  const modes: Record<string, string> = { admins: copy.modeAdmins, selected: copy.modeSelected, criteria: copy.modeCriteria, all: copy.modeAll };
  const roles: Record<string, string> = { any: copy.roleAny, moderator: copy.roleModerator, user: copy.roleUser };
  const effects: Record<string, string> = { allow: copy.effectAllow, deny: copy.effectDeny };
  if (typeof value.enabled === 'boolean') rows.push([copy.enabled, value.enabled ? copy.enabled : copy.paused]);
  if (typeof value.mode === 'string' && modes[value.mode]) rows.push([copy.mode, modes[value.mode]]);
  const date = (key: string, label: string) => {
    if (key in value) rows.push([label, typeof value[key] === 'string' ? formatLuanda(value[key], locale) : copy.unlimited]);
  };
  date('startsAt', copy.startsAt);
  date('endsAt', copy.endsAt);
  // Audit snapshots of exceptions use the original database field names.
  date('expires_at', copy.expiresAt);
  if (isRecord(value.criteria)) {
    const criteria = value.criteria;
    if (typeof criteria.role === 'string' && roles[criteria.role]) rows.push([copy.role, roles[criteria.role]]);
    if (typeof criteria.minAccountAgeDays === 'number') rows.push([copy.minimumAge, `${criteria.minAccountAgeDays} ${copy.days}`]);
    if (Array.isArray(criteria.groupIds)) {
      const names = criteria.groupIds.map(id => groups.find(group => group.id === id)?.name || copy.noValue);
      rows.push([copy.groupCriteria, names.length ? names.join(', ') : copy.unlimited]);
    }
  }
  if (typeof value.effect === 'string' && effects[value.effect]) rows.push([copy.effect, effects[value.effect]]);
  if (typeof value.note === 'string' && value.note) rows.push([copy.note, value.note]);
  if (typeof value.name === 'string') rows.push([copy.groupName, value.name]);
  if (typeof value.groupId === 'string') {
    const name = typeof value.groupName === 'string' ? value.groupName : groups.find(group => group.id === value.groupId)?.name;
    rows.push([copy.groups, value.included === false ? copy.noValue : name || copy.noValue]);
  }
  if (typeof value.preservedOverrides === 'number') rows.push([copy.overrideCount, String(value.preservedOverrides)]);
  return rows;
}

export function HistoryDetails({ entry, groups, locale, copy }: {
  entry: AuditEntry; groups: AccessGroup[]; locale: string; copy: AccessDashboardCopy;
}) {
  const before = snapshotRows(entry.before, groups, locale, copy);
  const after = snapshotRows(entry.after, groups, locale, copy);
  if (!before.length && !after.length) return null;
  return <details className="border-t pt-3">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">{copy.changes}</summary>
    <div className="grid gap-4 py-2 sm:grid-cols-2">
      {([{ label: copy.before, rows: before }, { label: copy.after, rows: after }]).map(({ label, rows }) => <section key={label} aria-label={label} className="min-w-0 rounded-lg bg-muted/50 p-3">
        <h3 className="mb-3 text-sm font-semibold">{label}</h3>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noValue}</p> : <dl className="space-y-3">
          {rows.map(([name, value]) => <div key={name} className="min-w-0 text-sm"><dt className="text-muted-foreground">{name}</dt><dd className="break-words">{value}</dd></div>)}
        </dl>}
      </section>)}
    </div>
  </details>;
}
