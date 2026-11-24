import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TrustedInvitesPanel } from './TrustedInvitesPanel';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));
const token = 'ab'.repeat(32);
const invitation = { id: 'invite-1', mode: 'direct', recipient_name: 'Pessoa Convidada', language: 'pt', expires_at: '2099-01-01T12:00:00Z', created_at: '2026-01-01T12:00:00Z', status: 'pending' };

afterEach(cleanup);
beforeEach(() => {
  invoke.mockReset().mockImplementation((_name: string, { body }: { body: { action: string } }) => Promise.resolve({ data: { ok: true, ...(body.action === 'status' ? { sms_ready: false } : body.action === 'list' ? { invitations: [] } : body.action === 'issue' ? { invitation, token } : {}) }, error: null }));
});

it('issues a direct 72 hour invitation and shows the same private URL in the link and QR', async () => {
  render(<TrustedInvitesPanel />);
  await screen.findByText('Ainda não foram emitidos convites de confiança.');
  expect(invoke).not.toHaveBeenCalledWith('trusted-invitations', { body: expect.objectContaining({ action: 'issue' }) });
  fireEvent.change(screen.getByLabelText('Nome da pessoa convidada'), { target: { value: 'Pessoa Convidada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar convite de confiança' }));
  const link = await screen.findByLabelText('Link individual');
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'issue', mode: 'direct', recipient_name: 'Pessoa Convidada', language: 'pt', expires_hours: 72 } });
  expect(link).toHaveValue(`https://www.yamilook.com/convite-confianca?lang=pt#trusted=${token}`);
  expect(screen.getByTitle('Convites de confiança').closest('svg')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enviar por email' })).not.toBeInTheDocument();
  const whatsapp = new URL(screen.getByRole('link', { name: 'Partilhar pelo WhatsApp' }).getAttribute('href')!);
  const message = whatsapp.searchParams.get('text') ?? '';
  expect(message).toContain((link as HTMLInputElement).value);
  expect(message.split('\n')).toContain(token);
});

it('does not offer an SMS promise when the backend has no SMS provider', async () => {
  render(<TrustedInvitesPanel />);
  await screen.findByText('A confirmação por SMS está indisponível. Pode emitir um convite de entrada directa.');
  expect(screen.getByRole('radio', { name: /Confirmar telefone/ })).toBeDisabled();
  expect(screen.getByRole('radio', { name: /Entrada directa/ })).toBeChecked();
});

it('binds phone invitations to the normalized number and chosen language', async () => {
  invoke.mockImplementation((_name: string, { body }: { body: { action: string } }) => Promise.resolve({ data: { ok: true, ...(body.action === 'status' ? { sms_ready: true } : body.action === 'list' ? { invitations: [] } : { invitation: { ...invitation, mode: 'phone', language: 'fr', masked_phone: '+244 *** *** 123' }, token }) }, error: null }));
  render(<TrustedInvitesPanel />);
  await waitFor(() => expect(screen.getByRole('radio', { name: /Confirmar telefone/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: /Confirmar telefone/ }));
  fireEvent.change(screen.getByLabelText('Nome da pessoa convidada'), { target: { value: 'Pessoa Convidada' } });
  fireEvent.change(screen.getByLabelText('Telefone da pessoa convidada'), { target: { value: '923 456 123' } });
  fireEvent.change(screen.getByLabelText('Idioma do convite'), { target: { value: 'fr' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar convite de confiança' }));
  await screen.findByLabelText('Link individual');
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'issue', mode: 'phone', recipient_name: 'Pessoa Convidada', language: 'fr', expires_hours: 72, phone: '+244923456123' } });
});

it('removes the share secret after cancellation without pretending to delete an activated account', async () => {
  render(<TrustedInvitesPanel />);
  await screen.findByText('Ainda não foram emitidos convites de confiança.');
  fireEvent.change(screen.getByLabelText('Nome da pessoa convidada'), { target: { value: 'Pessoa Convidada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar convite de confiança' }));
  await screen.findByLabelText('Link individual');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar convite: Pessoa Convidada' }));
  await waitFor(() => expect(screen.queryByLabelText('Link individual')).not.toBeInTheDocument());
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'revoke', id: 'invite-1' } });
  expect(screen.getByText('Entrada directa · Cancelado')).toBeInTheDocument();
});
