import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { AuditEntry } from './api';
import { accessDashboardCopy } from './copy';
import { HistoryDetails } from './HistoryDetails';

afterEach(cleanup);
const copy = accessDashboardCopy('pt');
const base: AuditEntry = { id: '1', feature: 'google_maps', action: 'policy_saved', actorName: 'Ana', targetName: null,
  createdAt: '2026-11-25T15:00:00Z', before: null, after: null };
const groups = [{ id: 'private-group-id', name: 'Equipa piloto', members: [] }];

it('shows policy snapshots with readable labels, group names and Luanda dates', () => {
  render(<HistoryDetails entry={{ ...base,
    before: { mode: 'admins', enabled: true, startsAt: null, endsAt: null },
    after: { mode: 'criteria', enabled: true, startsAt: '2026-12-01T08:00:00Z', endsAt: null,
      criteria: { role: 'moderator', groupIds: ['private-group-id'], minAccountAgeDays: 14 } },
  }} groups={groups} locale="pt" copy={copy} />);
  fireEvent.click(screen.getByText(copy.changes));
  expect(within(screen.getByRole('region', { name: copy.before })).getByText(copy.modeAdmins)).toBeInTheDocument();
  const after = within(screen.getByRole('region', { name: copy.after }));
  expect(after.getByText(copy.modeCriteria)).toBeInTheDocument();
  expect(after.getByText('Equipa piloto')).toBeInTheDocument();
  expect(after.getByText('14 dias')).toBeInTheDocument();
  expect(after.getByText(/09:00/)).toBeInTheDocument();
  expect(screen.queryByText('private-group-id')).not.toBeInTheDocument();
});

it('distinguishes the removed exception from its previous blocking state and note', () => {
  render(<HistoryDetails entry={{ ...base, action: 'override_inherit',
    before: { effect: 'deny', expires_at: null, note: 'Piloto concluído', updated_by: 'internal-admin-id' }, after: null,
  }} groups={groups} locale="pt" copy={copy} />);
  fireEvent.click(screen.getByText(copy.changes));
  expect(screen.getByText(copy.effectDeny)).toBeInTheDocument();
  expect(screen.getByText('Piloto concluído')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: copy.after })).getByText(copy.noValue)).toBeInTheDocument();
  expect(screen.queryByText('internal-admin-id')).not.toBeInTheDocument();
});

it('preserves the group name snapshot when a membership is removed', () => {
  render(<HistoryDetails entry={{ ...base, action: 'group_member_removed',
    before: { groupId: 'former-group', groupName: 'Piloto anterior', included: true },
    after: { groupId: 'former-group', groupName: 'Piloto anterior', included: false },
  }} groups={[]} locale="pt" copy={copy} />);
  fireEvent.click(screen.getByText(copy.changes));
  expect(within(screen.getByRole('region', { name: copy.before })).getByText('Piloto anterior')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: copy.after })).getByText(copy.noValue)).toBeInTheDocument();
});
