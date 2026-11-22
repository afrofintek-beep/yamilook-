import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppyPaySandbox } from './AppyPaySandbox';
import { appyPayAction, appyPayCapabilities, type AppyPayAttempt } from './appypay-api';
import { APPYPAY_COPY } from './appypay-labels';

vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt' }));
vi.mock('./appypay-api', async original => ({
  ...await original<typeof import('./appypay-api')>(),
  appyPayAction: vi.fn(), appyPayCapabilities: vi.fn(),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const attemptId = '44444444-4444-4444-8444-444444444444';
const api = vi.mocked(appyPayAction);
const storage = new Map<string, string>();
const pending = (overrides: Partial<AppyPayAttempt> = {}): AppyPayAttempt => ({
  id: attemptId, request_id: requestId, order_id: orderId, purpose: 'order', amount_minor: 1250,
  currency: 'AOA', method: 'GPO', state: 'pending', created_at: '2026-11-22T09:00:00Z', updated_at: '2026-11-22T09:00:00Z', ...overrides,
});

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
  vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => { storage.set(key, value); });
  vi.mocked(localStorage.removeItem).mockImplementation(key => { storage.delete(key); });
  vi.mocked(appyPayCapabilities).mockResolvedValue({ enabled: true, environment: 'sandbox', methods: ['GPO', 'REF'] });
  api.mockResolvedValue({ attempt: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('keeps the gateway option absent while the sandbox is disabled', async () => {
  vi.mocked(appyPayCapabilities).mockResolvedValue({ enabled: false, environment: 'sandbox', methods: [] });
  const { container } = render(<AppyPaySandbox userId={userId} amountMinor={1250} />);
  await waitFor(() => expect(appyPayCapabilities).toHaveBeenCalledOnce());
  expect(container).toBeEmptyDOMElement();
  expect(api).not.toHaveBeenCalled();
});

it('shows only provider REF data and confirms only after the server reports confirmation', async () => {
  const confirmed = vi.fn();
  const blocked = vi.fn();
  api.mockImplementation(async input => input.action === 'create'
    ? { attempt: pending({ method: 'REF', request_id: input.requestId, entity: '00123', reference: '456789012', provider_due_at: '2026-11-23T09:00:00Z' }) }
    : { attempt: null });
  render(<AppyPaySandbox userId={userId} orderId={orderId} amountMinor={1250} onConfirmed={confirmed} onBlockedChange={blocked} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Criar cobrança de teste' })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: 'Referência Multicaixa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Criar cobrança de teste' }));
  expect(await screen.findByText('456789012')).toBeInTheDocument();
  expect(screen.getByText('00123')).toBeInTheDocument();
  expect(screen.getByText('Prazo do prestador')).toBeInTheDocument();
  expect(confirmed).not.toHaveBeenCalled();
  expect(blocked).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole('button', { name: 'Novo teste' })).not.toBeInTheDocument();
  const creation = api.mock.calls.find(([input]) => input.action === 'create')![0];
  expect(creation).toMatchObject({ action: 'create', orderId, method: 'REF' });
  expect(creation).not.toHaveProperty('amountMinor');
  expect(creation).not.toHaveProperty('phone');
  api.mockResolvedValue({ attempt: pending({ state: 'confirmed', request_id: creation.requestId, method: 'REF' }) });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }));
  expect(await screen.findByText('Pagamento AppyPay de teste confirmado')).toBeInTheDocument();
  expect(confirmed).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(4));
  expect(confirmed).toHaveBeenCalledOnce();
});

it('recovers a lost create response after reload and retries the exact request only after an authoritative miss', async () => {
  const confirmed = vi.fn();
  api.mockImplementation(async input => {
    if (input.action === 'create') throw new Error('network');
    return { attempt: null };
  });
  const first = render(<AppyPaySandbox userId={userId} amountMinor={1250} onConfirmed={confirmed} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Testar carregamento' }));
  expect(await screen.findByText('Resultado por confirmar')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeEnabled());
  const sent = api.mock.calls.find(([input]) => input.action === 'create')![0];
  expect(sent).toMatchObject({ amountMinor: 1250, phone: '900000000' });
  expect(screen.queryByRole('button', { name: 'Novo teste' })).not.toBeInTheDocument();
  first.unmount();

  render(<AppyPaySandbox userId={userId} amountMinor={9999} onConfirmed={confirmed} />);
  const retry = await screen.findByRole('button', { name: 'Repetir o mesmo pedido' });
  expect(api.mock.calls.filter(([input]) => input.action === 'create')).toHaveLength(1);
  expect(api).toHaveBeenLastCalledWith({ action: 'status', requestId: sent.requestId });
  api.mockImplementation(async input => ({ attempt: pending({ purpose: 'topup', order_id: null, request_id: input.requestId! }) }));
  fireEvent.click(retry);
  await waitFor(() => expect(api.mock.calls.filter(([input]) => input.action === 'create')).toHaveLength(2));
  expect(api.mock.calls.filter(([input]) => input.action === 'create')[1][0]).toEqual(sent);
  expect(confirmed).not.toHaveBeenCalled();
});

it('sends a single MCX sandbox request on repeated clicks and offers only documented test numbers', async () => {
  let finish!: (result: { attempt: AppyPayAttempt }) => void;
  api.mockImplementation(input => input.action === 'create'
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ attempt: null }));
  const blocked = vi.fn();
  render(<AppyPaySandbox userId={userId} amountMinor={1250} onBlockedChange={blocked} />);
  const create = await screen.findByRole('button', { name: 'Testar carregamento' });
  expect(screen.getAllByRole('option').map(option => (option as HTMLOptionElement).value))
    .toEqual(['900000000', '900000001', '900000002', '900000003']);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Cenário de teste'), { target: { value: '900000002' } });
  fireEvent.click(create); fireEvent.click(create);
  expect(api.mock.calls.filter(([input]) => input.action === 'create')).toHaveLength(1);
  expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ phone: '900000002', method: 'GPO' }));
  expect(blocked).toHaveBeenLastCalledWith(true);
  await act(async () => { finish({ attempt: pending({ purpose: 'topup', order_id: null }) }); });
  expect(screen.getByText('A aguardar confirmação AppyPay')).toBeInTheDocument();
});

it('does not send a charge if the recovery request cannot be saved', async () => {
  vi.mocked(localStorage.setItem).mockImplementationOnce(() => { throw new Error('storage denied'); });
  render(<AppyPaySandbox userId={userId} amountMinor={1250} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Testar carregamento' }));
  expect(await screen.findByText('Não foi possível guardar o pedido neste dispositivo. Nenhuma cobrança foi enviada.')).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

it('lets the seller read status without creating or locally authorizing a charge', async () => {
  api.mockResolvedValue({ attempt: pending({ state: 'uncertain' }) });
  render(<AppyPaySandbox userId={userId} orderId={orderId} amountMinor={1250} readOnly />);
  expect(await screen.findByText('Resultado por confirmar')).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Criar cobrança|Novo teste|Repetir/ })).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith({ action: 'status', orderId });
});

it('recovers pending status on connectivity and foreground events', async () => {
  const confirmed = vi.fn();
  api.mockResolvedValue({ attempt: pending() });
  render(<AppyPaySandbox userId={userId} orderId={orderId} amountMinor={1250} onConfirmed={confirmed} />);
  expect(await screen.findByText('A aguardar confirmação AppyPay')).toBeInTheDocument();
  api.mockResolvedValue({ attempt: pending({ state: 'confirmed' }) });
  fireEvent(window, new Event('online'));
  expect(await screen.findByText('Pagamento AppyPay de teste confirmado')).toBeInTheDocument();
  expect(confirmed).toHaveBeenCalledOnce();
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
  expect(confirmed).toHaveBeenCalledOnce();
});

it('provides every new label, state and sandbox scenario in the ten active languages', () => {
  expect(Object.keys(APPYPAY_COPY)).toEqual(['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu']);
  for (const copy of Object.values(APPYPAY_COPY)) {
    expect(Object.keys(copy)).toEqual(Object.keys(APPYPAY_COPY.pt));
    expect(Object.keys(copy.states)).toEqual(Object.keys(APPYPAY_COPY.pt.states));
    expect(copy.scenarios).toHaveLength(4);
    for (const value of [...Object.values(copy).filter(item => typeof item === 'string'), ...Object.values(copy.states), ...copy.scenarios]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  }
});
