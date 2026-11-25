import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationAccessManager } from './IntegrationAccessManager';
import { integrationAccessCopy, integrationAccessTranslations } from './copy';
import { appLanguages } from '@/i18n/afroloc-languages';

const { list, change, state } = vi.hoisted(() => ({
  list: vi.fn(), change: vi.fn(),
  state: { grants: [] as Array<{userId: string; username: string; displayName: string; googleMaps: boolean; maguela: boolean}> },
}));
vi.mock('./api', () => ({ listIntegrationGrants: list, setIntegrationGrant: change }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));

const profiles = [
  { id: 'ana', display_name: 'Ana Simões', username: 'ana', isAdmin: false },
  { id: 'admin', display_name: 'Administrador', username: 'admin', isAdmin: true },
];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><IntegrationAccessManager users={profiles} onRetryUsers={vi.fn()} /></QueryClientProvider>);
  return client;
}
async function selectProfile(id = 'ana') {
  fireEvent.change(screen.getByRole('combobox', { name: 'Escolher perfil' }), { target: { value: id } });
  await screen.findByRole('switch', { name: 'Google Maps' });
}

beforeEach(() => {
  list.mockReset(); change.mockReset(); state.grants = [];
  list.mockImplementation(async () => state.grants);
});
afterEach(cleanup);

describe('integration permissions administration', () => {
  it('waits for server confirmation before showing a granted integration', async () => {
    let resolve!: () => void;
    change.mockImplementation(() => new Promise<void>(done => { resolve = () => {
      state.grants = [{ userId: 'ana', username: 'ana', displayName: 'Ana Simões', googleMaps: true, maguela: false }];
      done();
    }; }));
    setup(); await selectProfile();
    const google = screen.getByRole('switch', { name: 'Google Maps' });
    fireEvent.click(google);
    expect(change).toHaveBeenCalledExactlyOnceWith('ana', 'google_maps', true);
    expect(google).not.toBeChecked(); expect(google).toBeDisabled();
    expect(screen.queryByText('Autorização actualizada.')).not.toBeInTheDocument();
    await act(async () => resolve());
    expect(await screen.findByText('Autorização actualizada.')).toBeInTheDocument();
    expect(google).toBeChecked();
    expect(screen.getByRole('switch', { name: 'MAGUELA' })).not.toBeChecked();
  });

  it('revokes one integration while preserving the other', async () => {
    state.grants = [{ userId: 'ana', username: 'ana', displayName: 'Ana Simões', googleMaps: true, maguela: true }];
    change.mockImplementation(async () => { state.grants = [{ ...state.grants[0], maguela: false }]; });
    setup(); await selectProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'MAGUELA' }));
    await screen.findByText('Autorização actualizada.');
    expect(change).toHaveBeenCalledExactlyOnceWith('ana', 'maguela', false);
    expect(screen.getByRole('switch', { name: 'MAGUELA' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Google Maps' })).toBeChecked();
  });

  it('keeps the confirmed values when a change fails', async () => {
    change.mockRejectedValue(new Error('Permission denied'));
    setup(); await selectProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'MAGUELA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a alteração.');
    expect(screen.getByRole('switch', { name: 'MAGUELA' })).not.toBeChecked();
    expect(screen.queryByText('Autorização actualizada.')).not.toBeInTheDocument();
  });

  it('does not present an unknown permission state as denied and allows retry', async () => {
    list.mockRejectedValueOnce(new Error('offline'));
    setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Escolher perfil' }), { target: { value: 'ana' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as autorizações.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('switch', { name: 'Google Maps' });
    expect(change).not.toHaveBeenCalled();
  });

  it('shows administrators automatic access without ineffective revocation controls', async () => {
    setup(); await selectProfile('admin');
    expect(screen.getByText('Administrador: acesso automático às duas integrações.')).toBeInTheDocument();
    for (const toggle of screen.getAllByRole('switch')) { expect(toggle).toBeChecked(); expect(toggle).toBeDisabled(); }
    expect(change).not.toHaveBeenCalled();
  });

  it('searches names without accents and preserves an explicitly selected profile', async () => {
    setup(); await selectProfile('ana');
    fireEvent.change(screen.getByLabelText('Pesquisar por nome ou @utilizador'), { target: { value: 'simoes' } });
    expect(screen.getByRole('option', { name: 'Ana Simões · @ana' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Administrador · @admin' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('ana');
  });
});

it('provides all administration labels in the ten public languages', () => {
  expect(Object.keys(integrationAccessTranslations).sort()).toEqual(appLanguages.map(language => language.code).sort());
  const keys = Object.keys(integrationAccessTranslations.pt).sort();
  for (const language of appLanguages) {
    const copy = integrationAccessCopy(language.code);
    expect(Object.keys(copy).sort()).toEqual(keys);
    expect(Object.values(copy).every(value => value.trim().length > 0)).toBe(true);
  }
  expect(integrationAccessCopy('pt-banda')).toBe(integrationAccessTranslations.pt);
});
