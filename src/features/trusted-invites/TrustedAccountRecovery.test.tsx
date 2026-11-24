import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TrustedAccountRecovery } from './TrustedAccountRecovery';
import { TrustedInvitationError } from './api';

const mocks = vi.hoisted(() => ({ recover: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, functions: {} } }));
vi.mock('@/lib/trusted-account-login', async original => ({
  ...await original<typeof import('@/lib/trusted-account-login')>(),
  recoverTrustedAccount: mocks.recover,
}));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function mount() {
  render(<MemoryRouter initialEntries={['/forgot-password']}><Routes>
    <Route path="/forgot-password" element={<TrustedAccountRecovery />} />
    <Route path="/login" element={<p>Entrada na conta</p>} />
  </Routes></MemoryRouter>);
}

function fill(password = 'NewPassword123', confirmation = password) {
  fireEvent.change(screen.getByLabelText('Nome de utilizador'), { target: { value: '@trusted_person' } });
  fireEvent.change(screen.getByLabelText('Código de recuperação'), { target: { value: 'a'.repeat(64) } });
  fireEvent.change(screen.getByLabelText('Nova palavra-passe'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repetir a nova palavra-passe'), { target: { value: confirmation } });
}

describe('trusted recovery user flow', () => {
  it('prevents an accidental password change when confirmation does not match', async () => {
    mount();
    fill('NewPassword123', 'DifferentPassword123');
    fireEvent.click(screen.getByRole('button', { name: 'Definir nova palavra-passe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('As palavras-passe não coincidem.');
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it('shows only the newly rotated code and requires a save acknowledgement before returning to login', async () => {
    mocks.recover.mockResolvedValue({ recovery_code: 'b'.repeat(64), username: 'trusted_person' });
    mount(); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Definir nova palavra-passe' }));
    expect(await screen.findByLabelText('Novo código de recuperação')).toHaveValue('b'.repeat(64));
    expect(screen.queryByLabelText('Código de recuperação')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nova palavra-passe')).not.toBeInTheDocument();
    expect(mocks.recover).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Voltar a entrar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guardei o novo código num lugar seguro.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar a entrar' }));
    await waitFor(() => expect(screen.getByText('Entrada na conta')).toBeInTheDocument());
  });

  it('reports a rate limit without displaying backend details or a false success', async () => {
    mocks.recover.mockRejectedValue(new TrustedInvitationError('rate_limited', 'internal identifier'));
    mount(); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Definir nova palavra-passe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiadas tentativas');
    expect(screen.queryByLabelText('Novo código de recuperação')).not.toBeInTheDocument();
    expect(screen.queryByText('internal identifier')).not.toBeInTheDocument();
  });
});
