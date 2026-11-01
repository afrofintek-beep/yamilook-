import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CallPushSettings from './CallPushSettings';
const { check, enable, disable, auth } = vi.hoisted(() => ({ check: vi.fn(), enable: vi.fn(), disable: vi.fn(), auth: { user: { id: 'u' } as { id: string } | null } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/call-push', () => ({ callPushStatus: check, enableCallPush: enable, disableCallPush: disable }));
const ready = { supported: true, message: null, enabled: false, publicKey: 'AQID', permission: 'default' };
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'u' }; check.mockResolvedValue(ready); enable.mockResolvedValue(undefined); });
afterEach(cleanup);

it('explains loading instead of displaying an inert activation button', () => {
  check.mockImplementation(() => new Promise(() => {}));
  render(<CallPushSettings />);
  expect(screen.getByRole('status')).toHaveTextContent('A verificar os alertas');
  expect(screen.getByRole('button', { name: 'A verificar…' })).toBeDisabled();
});
it('recovers from a failed check without leaving settings', async () => {
  check.mockRejectedValueOnce(new Error('A verificação dos alertas demorou demasiado. Verifica a ligação e toca em Tentar novamente.'));
  render(<CallPushSettings />);
  expect(await screen.findByRole('alert')).toHaveTextContent('demorou demasiado');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ativar alertas de chamadas' })).toBeEnabled());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(enable).not.toHaveBeenCalled();
});
it('activates directly on a tap and confirms only after successful registration', async () => {
  render(<CallPushSettings />);
  const button = await screen.findByRole('button', { name: 'Ativar alertas de chamadas' });
  check.mockResolvedValue({ ...ready, enabled: true, permission: 'granted' });
  fireEvent.click(button);
  expect(enable).toHaveBeenCalledWith('u', 'AQID');
  expect(await screen.findByText('Alertas ativos neste dispositivo.')).toBeInTheDocument();
});
it('explains denied permission and rechecks after the user changes phone settings', async () => {
  check.mockResolvedValue({ ...ready, permission: 'denied' });
  render(<CallPushSettings />);
  expect(await screen.findByText(/As notificações estão bloqueadas/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ativar alertas de chamadas' })).toBeDisabled();
  check.mockResolvedValue(ready);
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ativar alertas de chamadas' })).toBeEnabled());
});
it('gives a retry for missing server configuration', async () => {
  check.mockResolvedValue({ ...ready, publicKey: null });
  render(<CallPushSettings />);
  expect(await screen.findByText('O serviço de alertas ainda está a ser configurado.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Ativar alertas de chamadas' })).toBeDisabled();
});
it('explains iPhone installation instead of offering a misleading activation', async () => {
  check.mockResolvedValue({ ...ready, supported: false, publicKey: null, message: 'No iPhone ou iPad, usa Partilhar → Adicionar ao ecrã principal e abre a KOSOLOLA pelo ícone para ativar os alertas.' });
  render(<CallPushSettings />);
  expect(await screen.findByText(/abre a KOSOLOLA pelo ícone/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ativar alertas de chamadas' })).toBeDisabled();
});
it('ignores stale status from a previous account', async () => {
  let resolve!: (value: unknown) => void;
  check.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const view = render(<CallPushSettings />);
  auth.user = { id: 'other' }; view.rerender(<CallPushSettings />);
  await screen.findByRole('button', { name: 'Ativar alertas de chamadas' });
  resolve({ ...ready, enabled: true });
  await waitFor(() => expect(screen.queryByText('Alertas ativos neste dispositivo.')).toBeNull());
});
