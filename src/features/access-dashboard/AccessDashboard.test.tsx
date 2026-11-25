import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccessDashboard from './AccessDashboard';
import { AccessDashboardLink } from './AccessDashboardLink';
import { fromLuandaInput, toLuandaInput } from './time';
import type { DashboardData, FeaturePolicy } from './api';

const mocks = vi.hoisted(() => ({
  load: vi.fn(), save: vi.fn(), override: vi.fn(), createGroup: vi.fn(), member: vi.fn(), preview: vi.fn(), search: vi.fn(),
  retryAccess: vi.fn(), access: { admin: true, loading: false, error: null as Error | null },
}));
vi.mock('./api', () => ({
  loadDashboard: mocks.load, savePolicy: mocks.save, setOverride: mocks.override,
  createAccessGroup: mocks.createGroup, setGroupMember: mocks.member, previewAccess: mocks.preview, searchProfiles: mocks.search,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin', last_sign_in_at: '2026-11-25T10:00:00Z' } }) }));
vi.mock('@/features/integration-access/useIntegrationAccess', () => ({ useIntegrationAccess: () => ({ ...mocks.access, retry: mocks.retryAccess }) }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));

let data: DashboardData;
const ana = { id: 'ana', username: 'ana', displayName: 'Ana Simões', isAdmin: false, isModerator: false, createdAt: '2026-01-01T00:00:00Z' };
const admin = { ...ana, id: 'admin', username: 'admin', displayName: 'Administrador', isAdmin: true };

beforeEach(() => {
  for (const value of Object.values(mocks)) if (typeof value === 'function') value.mockReset();
  mocks.access.admin = true; mocks.access.loading = false; mocks.access.error = null;
  data = {
    policies: (['google_maps', 'maguela', 'wallet', 'business_registration'] as const).map(feature => ({
      feature, mode: 'admins', enabled: true, startsAt: null, endsAt: null,
      criteria: { role: 'any', groupIds: [], minAccountAgeDays: 0 }, revision: 1, updatedAt: '2026-11-25T00:00:00Z',
    })),
    groups: [{ id: 'pilot', name: 'Piloto', members: [] }], overrides: [], audit: [],
  };
  mocks.load.mockImplementation(async () => structuredClone(data));
  mocks.search.mockResolvedValue([ana, admin]);
  mocks.save.mockImplementation(async (policy: FeaturePolicy) => {
    data.policies = data.policies.map(item => item.feature === policy.feature ? { ...policy, revision: policy.revision + 1 } : item);
  });
  mocks.override.mockImplementation(async (feature, userId, effect, expiresAt, note) => {
    data.overrides = data.overrides.filter(item => item.feature !== feature || item.userId !== userId);
    if (effect !== 'inherit') data.overrides.push({ feature, userId, effect, expiresAt, note, username: ana.username, displayName: ana.displayName });
  });
  mocks.createGroup.mockImplementation(async name => { data.groups.push({ id: 'new-group', name, members: [] }); });
  mocks.member.mockImplementation(async (groupId, userId, included) => {
    data.groups = data.groups.map(group => group.id !== groupId ? group : { ...group, members: included ? [...group.members, { userId, username: ana.username, displayName: ana.displayName }] : group.members.filter(member => member.userId !== userId) });
  });
  mocks.preview.mockResolvedValue(data.policies.map(policy => ({ feature: policy.feature, allowed: false, reason: 'admins_only' })));
});
afterEach(cleanup);

function renderApp(node = <AccessDashboard />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
  return client;
}
async function setup() {
  const client = renderApp();
  await screen.findByRole('tab', { name: 'Funcionalidades' });
  return client;
}
const googleForm = () => within(screen.getByRole('form', { name: 'Google Maps' }));
async function people(profileId = 'ana') {
  fireEvent.click(screen.getByRole('tab', { name: 'Perfis' }));
  const panel = within(screen.getByRole('tabpanel', { name: 'Perfis' }));
  await waitFor(() => expect(panel.getByRole('option', { name: 'Ana Simões · @ana' })).toBeInTheDocument());
  fireEvent.change(panel.getByRole('combobox', { name: 'Escolher perfil' }), { target: { value: profileId } });
  return panel;
}

describe('central access dashboard', () => {
  it('does not load administration data without confirmed administrator access', () => {
    mocks.access.admin = false;
    renderApp();
    expect(screen.getByText('Este painel está reservado aos administradores.')).toBeInTheDocument();
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.search).not.toHaveBeenCalled();
  });

  it('distinguishes a failed permission check from denied access and offers retry', () => {
    mocks.access.admin = false; mocks.access.error = new Error('offline');
    renderApp();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível verificar o acesso.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(mocks.retryAccess).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('edits policies without autosaving and waits for confirmed save before success', async () => {
    await setup();
    let resolve!: () => void;
    mocks.save.mockImplementation((policy: FeaturePolicy) => new Promise<void>(done => { resolve = () => {
      data.policies[0] = { ...policy, revision: 2 }; done();
    }; }));
    fireEvent.change(googleForm().getByRole('combobox', { name: 'Quem pode aceder' }), { target: { value: 'all' } });
    expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(googleForm().getByRole('button', { name: 'Guardar alterações' }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ feature: 'google_maps', mode: 'all', revision: 1 }));
    expect(screen.queryByText('Alteração confirmada.')).not.toBeInTheDocument();
    await act(async () => resolve());
    expect(await screen.findByText('Alteração confirmada.')).toBeInTheDocument();
    expect(googleForm().getByRole('button', { name: 'Guardar alterações' })).toBeDisabled();
  });

  it('rejects a criteria policy without an actual criterion', async () => {
    await setup();
    fireEvent.change(googleForm().getByRole('combobox', { name: 'Quem pode aceder' }), { target: { value: 'criteria' } });
    fireEvent.click(googleForm().getByRole('button', { name: 'Guardar alterações' }));
    expect(googleForm().getByRole('alert')).toHaveTextContent('Define pelo menos um critério');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('submits role, group and account-age criteria together with Luanda schedule times', async () => {
    await setup();
    const form = googleForm();
    fireEvent.change(form.getByRole('combobox', { name: 'Quem pode aceder' }), { target: { value: 'criteria' } });
    fireEvent.change(form.getByRole('combobox', { name: 'Função' }), { target: { value: 'moderator' } });
    fireEvent.click(form.getByRole('checkbox', { name: 'Piloto' }));
    fireEvent.change(form.getByRole('spinbutton'), { target: { value: '14' } });
    fireEvent.change(form.getByLabelText('Disponível a partir de'), { target: { value: '2026-12-01T09:00' } });
    fireEvent.change(form.getByLabelText('Disponível até'), { target: { value: '2026-12-10T18:30' } });
    fireEvent.click(form.getByRole('button', { name: 'Guardar alterações' }));
    await screen.findByText('Alteração confirmada.');
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      criteria: { role: 'moderator', groupIds: ['pilot'], minAccountAgeDays: 14 },
      startsAt: '2026-12-01T08:00:00.000Z', endsAt: '2026-12-10T17:30:00.000Z',
    }));
  });

  it('keeps drafts across refreshes and exposes revision conflicts without overwriting them', async () => {
    await setup();
    fireEvent.change(googleForm().getByRole('combobox', { name: 'Quem pode aceder' }), { target: { value: 'all' } });
    data.policies[0] = { ...data.policies[0], revision: 2, mode: 'selected' };
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(googleForm().getByRole('alert')).toHaveTextContent('A política foi alterada'));
    expect(googleForm().getByRole('combobox', { name: 'Quem pode aceder' })).toHaveValue('all');
    expect(googleForm().getByRole('button', { name: 'Guardar alterações' })).toBeDisabled();
    fireEvent.click(googleForm().getByRole('button', { name: 'Descartar alterações' }));
    expect(googleForm().getByRole('combobox', { name: 'Quem pode aceder' })).toHaveValue('selected');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('preserves drafts across tabs and reports server conflicts without success', async () => {
    await setup();
    fireEvent.change(googleForm().getByRole('combobox', { name: 'Quem pode aceder' }), { target: { value: 'selected' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Grupos' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Funcionalidades' }));
    expect(googleForm().getByRole('combobox', { name: 'Quem pode aceder' })).toHaveValue('selected');
    mocks.save.mockRejectedValue(Object.assign(new Error('conflict'), { code: 'conflict' }));
    fireEvent.click(googleForm().getByRole('button', { name: 'Guardar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A política foi alterada');
    expect(screen.queryByText('Alteração confirmada.')).not.toBeInTheDocument();
    expect(googleForm().getByRole('combobox', { name: 'Quem pode aceder' })).toHaveValue('selected');
  });

  it('keeps draft content when a refresh fails and permits recovery', async () => {
    await setup();
    fireEvent.change(googleForm().getByRole('combobox', { name: 'Quem pode aceder' }), { target: { value: 'all' } });
    mocks.load.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os acessos.');
    expect(googleForm().getByRole('combobox', { name: 'Quem pode aceder' })).toHaveValue('all');
    expect(googleForm().getByRole('button', { name: 'Guardar alterações' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(googleForm().getByRole('button', { name: 'Guardar alterações' })).not.toBeDisabled());
  });

  it('stores a named profile exception with independent feature, expiry and reason', async () => {
    await setup(); const panel = await people();
    fireEvent.change(panel.getByRole('combobox', { name: 'Funcionalidades' }), { target: { value: 'maguela' } });
    fireEvent.change(panel.getByRole('combobox', { name: 'Excepção' }), { target: { value: 'allow' } });
    fireEvent.change(panel.getByLabelText(/Validade da excepção/), { target: { value: '2026-12-10T18:00' } });
    fireEvent.change(panel.getByRole('textbox', { name: 'Motivo' }), { target: { value: 'Piloto de mobilidade' } });
    fireEvent.click(panel.getByRole('button', { name: 'Aplicar excepção' }));
    await screen.findByText('Alteração confirmada.');
    expect(mocks.override).toHaveBeenCalledExactlyOnceWith('maguela', 'ana', 'allow', '2026-12-10T17:00:00.000Z', 'Piloto de mobilidade');
  });

  it('shows administrator access and disables ineffective individual overrides', async () => {
    await setup(); const panel = await people('admin');
    expect(panel.getByText('Administrador: acesso automático.')).toBeInTheDocument();
    expect(panel.getByRole('combobox', { name: 'Excepção' })).toBeDisabled();
    expect(panel.getByRole('button', { name: 'Aplicar excepção' })).toBeDisabled();
    expect(mocks.override).not.toHaveBeenCalled();
  });

  it('rejects an already expired exception and explains wallet consequences before applying it', async () => {
    await setup(); const panel = await people();
    fireEvent.change(panel.getByRole('combobox', { name: 'Funcionalidades' }), { target: { value: 'wallet' } });
    expect(panel.getByText(/pagamentos pendentes/i)).toBeInTheDocument();
    fireEvent.change(panel.getByRole('combobox', { name: 'Excepção' }), { target: { value: 'deny' } });
    fireEvent.change(panel.getByLabelText(/Validade da excepção/), { target: { value: '2000-01-01T09:00' } });
    fireEvent.click(panel.getByRole('button', { name: 'Aplicar excepção' }));
    expect(panel.getByRole('alert')).toHaveTextContent(/futur/i);
    expect(mocks.override).not.toHaveBeenCalled();
  });

  it('creates a group and confirms membership additions and removals', async () => {
    await setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Grupos' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Grupos' }));
    fireEvent.change(panel.getByRole('textbox', { name: 'Nome do grupo' }), { target: { value: 'Promotores' } });
    fireEvent.click(panel.getByRole('button', { name: 'Criar grupo' }));
    await panel.findByRole('option', { name: 'Promotores (0)' });
    fireEvent.change(panel.getByRole('combobox', { name: 'Escolher grupo' }), { target: { value: 'new-group' } });
    await panel.findByRole('option', { name: 'Ana Simões · @ana' });
    fireEvent.change(panel.getByRole('combobox', { name: 'Escolher perfil' }), { target: { value: 'ana' } });
    fireEvent.click(panel.getByRole('button', { name: 'Adicionar membro' }));
    const remove = await panel.findByRole('button', { name: 'Retirar membro' });
    expect(mocks.member).toHaveBeenCalledWith('new-group', 'ana', true);
    fireEvent.click(remove);
    await waitFor(() => expect(panel.queryByRole('button', { name: 'Retirar membro' })).not.toBeInTheDocument());
    expect(mocks.member).toHaveBeenCalledWith('new-group', 'ana', false);
  });

  it('previews all four features with readable reasons without changing permissions', async () => {
    mocks.preview.mockResolvedValue([
      { feature: 'google_maps', allowed: true, reason: 'explicit_allow' }, { feature: 'maguela', allowed: false, reason: 'disabled' },
      { feature: 'wallet', allowed: false, reason: 'not_started' }, { feature: 'business_registration', allowed: true, reason: 'business_invitation' },
    ]);
    await setup(); const panel = await people();
    fireEvent.click(panel.getByRole('button', { name: 'Verificar acesso' }));
    expect(await panel.findByText('Motivo: Excepção individual de permissão')).toBeInTheDocument();
    expect(panel.getByText('Motivo: Funcionalidade pausada')).toBeInTheDocument();
    expect(panel.getByText('Motivo: Convite válido para criar um negócio')).toBeInTheDocument();
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith('ana');
    expect(mocks.override).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });

  it('offers actual managers for other modules instead of permission switches', async () => {
    await setup();
    expect(screen.getByRole('link', { name: 'Convites de confiança' })).toHaveAttribute('href', '/admin#convites-confianca');
    expect(screen.getByRole('link', { name: 'Mentores' })).toHaveAttribute('href', '/admin/mentors');
    expect(screen.getByRole('link', { name: 'Administração do Dangereux' })).toHaveAttribute('href', '/app/dangereux/');
  });

  it('shows the last-100 history limit and readable before/after policy values without internal identifiers', async () => {
    data.audit = [
      { id: 'history-policy', feature: 'google_maps', action: 'policy_saved', actorName: 'Administrador', targetName: null, createdAt: '2026-11-25T11:00:00Z',
        before: { mode: 'admins', enabled: true },
        after: { mode: 'criteria', enabled: true, criteria: { role: 'moderator', groupIds: ['pilot'], minAccountAgeDays: 14 } } },
      { id: 'history-import', feature: null, action: 'legacy_import', actorName: 'Administrador', targetName: null, createdAt: '2026-11-25T10:00:00Z', before: null, after: { preservedOverrides: 3 } },
    ];
    await setup(); fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Histórico' }));
    expect(panel.getByText(/100 alterações mais recentes/)).toBeInTheDocument();
    expect(panel.getByText('Permissões anteriores preservadas')).toBeInTheDocument();
    const article = within(panel.getByText('Política actualizada').closest('article')!);
    fireEvent.click(article.getByText('Ver alterações'));
    expect(within(article.getByRole('region', { name: 'Antes' })).getByText('Apenas administradores')).toBeInTheDocument();
    const after = within(article.getByRole('region', { name: 'Depois' }));
    expect(after.getByText('Por critérios')).toBeInTheDocument(); expect(after.getByText('Piloto')).toBeInTheDocument();
    expect(after.getByText('14 dias')).toBeInTheDocument();
    expect(after.queryByText('groupIds')).not.toBeInTheDocument(); expect(after.queryByText('pilot')).not.toBeInTheDocument();
  });
});

it('shows the dashboard entry only to a confirmed administrator', () => {
  mocks.access.admin = false;
  const { rerender } = render(<MemoryRouter><AccessDashboardLink /></MemoryRouter>);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  mocks.access.admin = true;
  rerender(<MemoryRouter><AccessDashboardLink external /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Gerir acessos' })).toHaveAttribute('href', 'https://www.yamilook.com/admin/acessos?lang=pt');
});

describe('Luanda schedule conversion', () => {
  it('converts Luanda to UTC across midnight independently of the device timezone', () => {
    expect(fromLuandaInput('2026-12-01T00:30')).toBe('2026-11-30T23:30:00.000Z');
    expect(toLuandaInput('2026-11-30T23:30:00.000Z')).toBe('2026-12-01T00:30');
  });
  it('allows empty optional bounds and rejects invalid calendar dates', () => {
    expect(fromLuandaInput('')).toBeNull(); expect(toLuandaInput(null)).toBe('');
    expect(() => fromLuandaInput('2026-02-30T10:00')).toThrow('invalid_schedule');
    expect(() => fromLuandaInput('2026-12-01')).toThrow('invalid_schedule');
  });
});
