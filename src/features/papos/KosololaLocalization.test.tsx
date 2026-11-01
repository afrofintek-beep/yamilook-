import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n, { changeAppLanguage } from '@/i18n';
import { afrolocLanguages } from '@/i18n/afroloc-languages';
import PaposLanguageSelector from './PaposLanguageSelector';
import CallRingtoneSettings from './CallRingtoneSettings';
import CallPushSettings from './CallPushSettings';
import { ConnectedDevices } from '@/components/settings/ConnectedDevices';
import { MemoryRouter } from 'react-router-dom';
import PaposInstall from './PaposInstall';
import manifest from '../../../docs/kosolola-i18n-batch-2.json';
import pt from '@/i18n/locales/pt.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import ar from '@/i18n/locales/ar.json';
const { save, status, revoke, sessions } = vi.hoisted(() => ({ save: vi.fn(), status: vi.fn(), revoke: vi.fn(), sessions: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test' } }) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ settings: { ringtone_enabled: true }, loading: false, updateSettings: save }) }));
vi.mock('@/hooks/useRingtone', () => ({ useRingtonePreview: () => ({ playPreview: vi.fn(), stopRingtone: vi.fn() }) }));
vi.mock('@/lib/call-push', () => ({ callPushStatus: status, enableCallPush: vi.fn(), disableCallPush: vi.fn() }));
vi.mock('@/lib/account-sessions', () => ({ listAccountSessions: sessions, listLoginAlerts: async () => [], revokeAccountSession: revoke }));
beforeEach(async () => {
  vi.clearAllMocks(); await changeAppLanguage('pt');
  save.mockResolvedValue({ error: new Error('offline') });
  status.mockRejectedValue(new Error(pt.kosolola.pushTimeout));
  sessions.mockResolvedValue([{ id: 'other', device_label: 'Safari <test>', last_seen: '2026-11-01T10:00:00Z', is_current: false }]);
});
afterEach(async () => { cleanup(); await act(() => changeAppLanguage('pt')); vi.restoreAllMocks(); });

it.each(afrolocLanguages.map(l => l.code))('switches mounted controls to %s and persists the choice', async code => {
  render(<><PaposLanguageSelector /><CallRingtoneSettings /><CallPushSettings /></>);
  await screen.findByRole('alert');
  fireEvent.change(screen.getByRole('combobox', { name: /Idioma/ }), { target: { value: code } });
  await waitFor(() => expect(i18n.language).toBe(code));
  expect(localStorage.setItem).toHaveBeenCalledWith('i18nextLng', code);
  expect(document.documentElement.dir).toBe(code === 'ar' ? 'rtl' : 'ltr');
  expect(screen.getByRole('heading', { name: i18n.t('kosolola.pushTitle') })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('kosolola.pushTimeout'));
});

it('retranslates an already displayed ringtone error without saving again', async () => {
  render(<CallRingtoneSettings />);
  fireEvent.change(screen.getByLabelText(pt.kosolola.chooseRingtone), { target: { value: 'gentle' } });
  await screen.findByRole('alert');
  await act(() => changeAppLanguage('fr'));
  expect(screen.getByRole('alert')).toHaveTextContent(fr.kosolola.ringtoneSaveError);
  expect(save).toHaveBeenCalledTimes(1);
});

it('localizes revocation confirmation without changing its target', async () => {
  await changeAppLanguage('ar');
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ConnectedDevices />);
  fireEvent.click(await screen.findByRole('button', { name: i18n.t('kosolola.devicesRevokeLabel', { device: 'Safari <test>' }) }));
  expect(confirm).toHaveBeenCalledWith(i18n.t('kosolola.devicesConfirm', { device: 'Safari <test>' }));
  expect(revoke).toHaveBeenCalledWith('other');
});

it('keeps all new interpolation placeholders and explicit review status', () => {
  for (const key of manifest.keys) {
    const k = key.split('.')[1];
    const placeholders = (value: string) => value.match(/{{\w+}}/g)?.sort() ?? [];
    for (const locale of [en, fr, ar]) {
      expect(locale.kosolola[k]).toBeTruthy();
      expect(placeholders(locale.kosolola[k])).toEqual(placeholders(pt.kosolola[k]));
    }
  }
  expect(manifest.approved_translations).toEqual([]);
});

it('updates installation instructions when the language changes', async () => {
  render(<MemoryRouter><PaposInstall /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: pt.kosolola.installTitle })).toBeVisible();
  await act(() => changeAppLanguage('ar'));
  expect(screen.getByRole('heading', { name: ar.kosolola.installTitle })).toBeVisible();
  expect(screen.getByText(ar.kosolola.installIos)).toBeVisible();
  expect(screen.getByRole('link', { name: ar.kosolola.installContinue })).toHaveAttribute('href', '/papos');
});
