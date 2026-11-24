import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TrustedInviteRegistration from './TrustedInviteRegistration';

const { invoke, setSession, auth } = vi.hoisted(() => ({ invoke: vi.fn(), setSession: vi.fn(), auth: { user: null as null | { id: string }, loading: false } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke }, auth: { setSession } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));
vi.mock('@/i18n', () => ({ changeAppLanguage: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/components/brand/YamilookLogo', () => ({ default: () => <div>Yamilook</div> }));
const token = 'ab'.repeat(32);
const recovery = '12'.repeat(32);
const invitation = { recipient_name: 'Pessoa Convidada', inviter_name: 'António', mode: 'direct', language: 'pt', expires_at: '2099-01-01T12:00:00Z', status: 'pending' };
function Destination() { const location = useLocation(); return <p>{location.pathname}{location.search}</p>; }
function show(url = `/convite-confianca?lang=pt#trusted=${token}`) {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/convite-confianca" element={<TrustedInviteRegistration />} /><Route path="/onboarding" element={<Destination />} /><Route path="/login" element={<Destination />} />
  </Routes></MemoryRouter>);
}
async function fillForm() {
  await screen.findByLabelText('Nome de utilizador');
  fireEvent.change(screen.getByLabelText('Nome de utilizador'), { target: { value: 'pessoa_teste' } });
  fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: 'PasswordSeguro123' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Aceito os/ }));
}
afterEach(cleanup);
beforeEach(() => {
  auth.user = null;
  invoke.mockReset().mockImplementation((_name: string, { body }: { body: { action: string } }) => Promise.resolve({ data: { ok: true, ...(body.action === 'preview' ? { invitation } : body.action === 'request_otp' ? { retry_after: 60 } : { account_created: true, username: 'pessoa_teste', recovery_code: recovery, session: { access_token: 'access', refresh_token: 'refresh' } }) }, error: null }));
  setSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'new-user' } } }, error: null });
});

it('only previews on opening and never asks for or confirms an email', async () => {
  show();
  await screen.findByRole('heading', { name: 'O seu acesso foi pré-aprovado' });
  expect(invoke.mock.calls).toHaveLength(1);
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'preview', token } });
  expect(screen.queryByLabelText(/e-?mail/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Activar a minha conta' })).toBeDisabled();
});

it.each([
  ['shared code', token],
  ['complete old link', `https://www.yamilook.com/register?lang=pt#trusted=${token}`],
  ['complete new link', `https://www.yamilook.com/convite-confianca?lang=pt#trusted=${token}`],
])('recovers with the %s when a shared link arrives without its fragment', async (_method, input) => {
  show('/convite-confianca?lang=pt');
  expect(invoke).not.toHaveBeenCalled();
  const field = screen.getByLabelText('Código ou link do convite');
  const submit = screen.getByRole('button', { name: 'Verificar convite' });
  fireEvent.change(field, { target: { value: 'https://www.yamilook.com/convite-confianca?lang=pt' } });
  fireEvent.click(submit);
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: input } });
  fireEvent.click(submit);
  await screen.findByRole('heading', { name: 'O seu acesso foi pré-aprovado' });
  expect(invoke).toHaveBeenCalledExactlyOnceWith('trusted-invitations', { body: { action: 'preview', token } });
  expect(screen.queryByLabelText(/e-?mail/i)).not.toBeInTheDocument();
});

it('keeps the recovery code visible after session creation until it has been saved', async () => {
  show();
  await fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Activar a minha conta' }));
  await screen.findByRole('heading', { name: 'Conta activada' });
  expect(screen.getByLabelText('Código de recuperação')).toHaveValue(recovery);
  expect(setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
  const continueButton = await screen.findByRole('button', { name: 'Continuar para o meu perfil' });
  expect(continueButton).toBeDisabled();
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'activate', token, username: 'pessoa_teste', display_name: 'Pessoa Convidada', password: 'PasswordSeguro123', accepted_terms: true } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Guardei o meu código de recuperação.' }));
  fireEvent.click(continueButton);
  expect(await screen.findByText('/onboarding?lang=pt')).toBeInTheDocument();
});

it('preserves the recovery code and offers login if the new session cannot be established', async () => {
  setSession.mockRejectedValue(new Error('offline'));
  show(); await fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Activar a minha conta' }));
  await screen.findByText('A conta foi criada. Utilize o seu nome de utilizador e palavra-passe para entrar.');
  expect(screen.getByLabelText('Código de recuperação')).toHaveValue(recovery);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Guardei o meu código de recuperação.' }));
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na minha conta' }));
  expect(await screen.findByText('/login?lang=pt')).toBeInTheDocument();
});

it('requests a bound phone OTP only on a click and supplies it during activation', async () => {
  invoke.mockImplementation((_name: string, { body }: { body: { action: string } }) => Promise.resolve({ data: { ok: true, ...(body.action === 'preview' ? { invitation: { ...invitation, mode: 'phone', masked_phone: '+244 *** *** 123' } } : body.action === 'request_otp' ? { retry_after: 60 } : { account_created: true, username: 'pessoa_teste', recovery_code: recovery, session: null }) }, error: null }));
  show(); await fillForm();
  expect(invoke.mock.calls).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Activar a minha conta' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Pedir código por SMS' }));
  await screen.findByText('Pedido de SMS aceite. Introduza o código recebido.');
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: { action: 'request_otp', token } });
  fireEvent.change(screen.getByLabelText('Código recebido por SMS'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Activar a minha conta' }));
  await screen.findByRole('heading', { name: 'Conta activada' });
  expect(invoke).toHaveBeenCalledWith('trusted-invitations', { body: expect.objectContaining({ action: 'activate', otp: '123456' }) });
});

it('does not replace an existing user session with an invited account', async () => {
  auth.user = { id: 'existing-user' };
  show();
  await screen.findByText('Já tem uma sessão iniciada. Este convite cria uma nova conta; continue na sua conta actual.');
  expect(screen.queryByRole('button', { name: 'Activar a minha conta' })).not.toBeInTheDocument();
  expect(setSession).not.toHaveBeenCalled();
  expect(invoke).not.toHaveBeenCalledWith('trusted-invitations', { body: expect.objectContaining({ action: 'activate' }) });
});

it('discards the prior recipient details when a different invitation arrives through SPA navigation', async () => {
  const nextToken = 'cd'.repeat(32);
  invoke.mockImplementation((_name: string, { body }: { body: { action: string; token: string } }) => Promise.resolve({ data: { ok: true, invitation: { ...invitation, recipient_name: body.token === nextToken ? 'Segunda pessoa' : invitation.recipient_name } }, error: null }));
  function SwitchInvite() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate('/convite-confianca?lang=pt#trusted=' + nextToken)}>Trocar convite</button><TrustedInviteRegistration /></>;
  }
  render(<MemoryRouter initialEntries={['/convite-confianca?lang=pt#trusted=' + token]}><SwitchInvite /></MemoryRouter>);
  await fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Trocar convite' }));
  await waitFor(() => expect(screen.getByLabelText('O seu nome')).toHaveValue('Segunda pessoa'));
  expect(screen.getByLabelText('Nome de utilizador')).toHaveValue('');
  expect(screen.getByLabelText('Palavra-passe')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name: /Aceito os/ })).not.toBeChecked();
  expect(invoke).not.toHaveBeenCalledWith('trusted-invitations', { body: expect.objectContaining({ action: 'activate' }) });
});
