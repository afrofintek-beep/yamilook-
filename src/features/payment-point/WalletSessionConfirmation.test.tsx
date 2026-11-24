import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { WalletSessionConfirmation } from './WalletSessionConfirmation';

const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(), challengeAndVerify: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { mfa } } }));

it('keeps an invalid challenge open and returns to the wallet after verification', async () => {
  mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor', status: 'verified' }] } });
  mfa.challengeAndVerify.mockResolvedValueOnce({ error: {} }).mockResolvedValueOnce({ error: null });
  const close = vi.fn();
  render(<WalletSessionConfirmation onClose={close} />);
  const input = await screen.findByLabelText('Código de 6 dígitos');
  for (const code of ['111111', '222222']) {
    fireEvent.change(input, { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar sessão' }));
    if (code === '111111') expect(await screen.findByRole('alert')).toBeVisible();
  }
  fireEvent.click(await screen.findByRole('button', { name: 'Voltar à carteira' }));
  expect(mfa.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: 'factor', code: '222222' });
  expect(close).toHaveBeenCalledOnce();
});
