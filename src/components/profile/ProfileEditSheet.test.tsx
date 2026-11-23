import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProfileEditSheet } from './ProfileEditSheet';

const mocks = vi.hoisted(() => ({
  locale: 'pt',
  trusted: true,
  from: vi.fn(),
  lookup: vi.fn(),
  update: vi.fn(),
  refreshProfile: vi.fn(),
  onUpdate: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'profile-id',
      app_metadata: { trusted_account: mocks.trusted },
      user_metadata: { trusted_account: true },
    },
    profile: {},
    refreshProfile: mocks.refreshProfile,
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => mocks.locale, uiText: (value: string) => value }));
vi.mock('./BandaChangeSheet', () => ({ BandaChangeSheet: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const profile = {
  id: 'profile-id',
  display_name: 'Maria Silva',
  username: 'maria_silva',
  avatar_url: null,
  bio: null,
  status_message: null,
  profile_theme_color: '#6366f1',
  show_last_seen: true,
  show_online_status: true,
  show_read_receipts: true,
  show_typing_indicators: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = 'pt';
  mocks.trusted = true;
  mocks.refreshProfile.mockResolvedValue(undefined);
  mocks.lookup.mockReturnValue({ neq: () => ({ single: async () => ({ data: null, error: null }) }) });
  mocks.update.mockReturnValue({ eq: async () => ({ error: null }) });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'public_profiles') return { select: () => ({ eq: mocks.lookup }) };
    if (table === 'profiles') return { update: mocks.update };
    throw new Error(`Unexpected table: ${table}`);
  });
});
afterEach(cleanup);

function editUsername(value: string) {
  render(<ProfileEditSheet open onOpenChange={mocks.onOpenChange} profile={profile} onUpdate={mocks.onUpdate} />);
  const input = screen.getByLabelText('Username');
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  return input;
}

it.each([
  ['pt', 'maria.silva', '3 a 20 caracteres: letras, números e _. Comece com uma letra ou número.'],
  ['en', 'maria silva', '3–20 characters: letters, numbers and _. Start with a letter or number.'],
  ['fr', '@maria_silva', '3 à 20 caractères : lettres, chiffres et _. Commencez par une lettre ou un chiffre.'],
])('prevents a trusted profile edit from breaking username access, with %s feedback', async (locale, username, message) => {
  mocks.locale = locale;
  const input = editUsername(username);

  await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
  expect(input).toHaveAccessibleDescription(`${message} ${message}`);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.onUpdate).not.toHaveBeenCalled();
  expect(mocks.onOpenChange).not.toHaveBeenCalled();
});

it('saves an edited trusted username in the canonical format used for sign-in', async () => {
  editUsername('  New_Name12  ');

  await waitFor(() => expect(mocks.onOpenChange).toHaveBeenCalledWith(false));
  expect(mocks.lookup).toHaveBeenCalledWith('username', 'new_name12');
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ username: 'new_name12' }));
  expect(mocks.refreshProfile).toHaveBeenCalledOnce();
  expect(mocks.onUpdate).toHaveBeenCalledOnce();
});

it('preserves ordinary accounts’ existing username rules even with user-controlled trusted metadata', async () => {
  mocks.trusted = false;
  editUsername('  Regular.Name  ');

  await waitFor(() => expect(mocks.onOpenChange).toHaveBeenCalledWith(false));
  expect(mocks.lookup).toHaveBeenCalledWith('username', 'regular.name');
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ username: 'regular.name' }));
  expect(mocks.onUpdate).toHaveBeenCalledOnce();
});
