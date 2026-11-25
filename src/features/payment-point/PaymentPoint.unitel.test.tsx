import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PaymentPoint from './PaymentPoint';
import { paymentAction, type PaymentOrder } from './api';
import { appyPayAction, appyPayCapabilities, type AppyPayAttempt } from './appypay-api';
import { unitelAction, unitelCapabilities, type UnitelAttempt } from './unitel-api';
import { UNITEL_COPY } from './unitel-labels';

vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: () => 'pt', uiLocale: () => 'pt', uiText: (source: string) => source }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useMessageNotification', () => ({ useMessageNotification: () => ({ notifyMessage: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' } }) }));
vi.mock('./WalletAccess', () => ({ WalletAccessManager: () => null }));
vi.mock('./TransferSecurity', () => ({ TransferSecurity: () => null, preferences: vi.fn().mockResolvedValue({ blocked: false }) }));
vi.mock('./RequestPayment', () => ({ RequestPayment: () => null }));
vi.mock('./ScanPayment', () => ({ ScanPayment: () => null }));
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), paymentAction: vi.fn() }));
vi.mock('./appypay-api', async original => ({
  ...await original<typeof import('./appypay-api')>(), appyPayAction: vi.fn(), appyPayCapabilities: vi.fn(),
}));
vi.mock('./unitel-api', async original => ({
  ...await original<typeof import('./unitel-api')>(), unitelAction: vi.fn(), unitelCapabilities: vi.fn(),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const attemptId = '44444444-4444-4444-8444-444444444444';
const copy = UNITEL_COPY.pt;
const unitelApi = vi.mocked(unitelAction);
const appyApi = vi.mocked(appyPayAction);
const unitelPending = (overrides: Partial<UnitelAttempt> = {}): UnitelAttempt => ({
  id: attemptId, request_id: requestId, order_id: orderId, amount_minor: 1250, currency: 'AOA',
  purpose: 'order', method: 'UNITEL_MONEY', state: 'pending',
  created_at: '2026-11-25T09:00:00Z', updated_at: '2026-11-25T09:00:00Z', ...overrides,
});
const appyPending = (overrides: Partial<AppyPayAttempt> = {}): AppyPayAttempt => ({ ...unitelPending(), method: 'GPO', ...overrides });
let order: PaymentOrder;

beforeEach(() => {
  vi.clearAllMocks(); unitelApi.mockReset(); appyApi.mockReset();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  vi.mocked(localStorage.setItem).mockImplementation(() => undefined);
  sessionStorage.clear();
  order = { id: orderId, seller_id: '55555555-5555-4555-8555-555555555555', amount: 1250,
    description: 'Compra de teste', status: 'pending', expires_at: '2099-01-01T00:00:00Z', own: false };
  vi.mocked(paymentAction).mockImplementation(async action => (action === 'view' ? order : {
    mode: 'sandbox', country_code: 'AO', currency: 'AOA', admin: false,
    wallet: { user_id: userId, purchased: 100000, earned: 0, reserved: 0, merchant: false },
    orders: [], entries: [], withdrawals: [],
  }) as never);
  vi.mocked(unitelCapabilities).mockResolvedValue({ enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones: ['+244900000021'] });
  vi.mocked(appyPayCapabilities).mockResolvedValue({ enabled: true, environment: 'sandbox', methods: ['GPO', 'REF'] });
  unitelApi.mockResolvedValue({ attempt: null }); appyApi.mockResolvedValue({ attempt: null });
});
afterEach(() => cleanup());

function renderOrder() {
  render(<MemoryRouter initialEntries={[`/payment-point/${orderId}`]}><Routes>
    <Route path="/payment-point/:id" element={<PaymentPoint />} />
  </Routes></MemoryRouter>);
}

it('blocks local and Appy creation as soon as a UNITEL charge is submitted', async () => {
  let finish!: (response: { attempt: UnitelAttempt }) => void;
  let submittedRequest = '';
  unitelApi.mockImplementation(input => {
    if (input.action === 'status') return Promise.resolve({ attempt: null });
    submittedRequest = input.requestId;
    return new Promise(resolve => { finish = resolve; });
  });
  renderOrder();
  await waitFor(() => expect(screen.getByRole('button', { name: copy.start })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Criar cobrança de teste' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: copy.start }));
  expect(screen.getByRole('button', { name: 'Confirmar simulação' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Criar cobrança de teste' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar simulação' }));
  expect(vi.mocked(paymentAction).mock.calls.some(([action]) => action === 'pay')).toBe(false);
  expect(appyApi.mock.calls.some(([input]) => input.action === 'create')).toBe(false);
  await act(async () => { finish({ attempt: unitelPending({ request_id: submittedRequest }) }); });
  expect(screen.getByRole('button', { name: copy.check })).toBeEnabled();
});

it('blocks UNITEL and local creation while an Appy attempt is pending', async () => {
  appyApi.mockResolvedValue({ attempt: appyPending() });
  renderOrder();
  expect(await screen.findByText('A aguardar confirmação AppyPay')).toBeInTheDocument();
  await waitFor(() => expect(unitelApi).toHaveBeenCalledWith({ action: 'status', orderId }));
  expect(screen.getByRole('button', { name: 'Confirmar simulação' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: copy.start })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeEnabled();
  expect(unitelApi.mock.calls.some(([input]) => input.action === 'create')).toBe(false);
});

it('recovers a UNITEL attempt without a local request and keeps the other payment paths blocked', async () => {
  unitelApi.mockResolvedValue({ attempt: unitelPending({ state: 'uncertain' }) });
  renderOrder();
  expect(await screen.findByText(copy.states.uncertain)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirmar simulação' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Criar cobrança de teste' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: copy.check })).toBeEnabled();
});

it('shows the UNITEL receipt and never offers a local refund for its external payment', async () => {
  order = { ...order, own: true, seller_id: userId, buyer_id: '66666666-6666-4666-8666-666666666666', status: 'paid', payment_provider: 'unitel' };
  vi.mocked(unitelCapabilities).mockResolvedValue({ enabled: false, environment: 'sandbox', methods: [] });
  renderOrder();
  expect(await screen.findByText(new RegExp(copy.states.confirmed))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reembolsar compra' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Pagamento AppyPay de teste confirmado/)).not.toBeInTheDocument();
  expect(vi.mocked(paymentAction).mock.calls.some(([action]) => action === 'refund')).toBe(false);
});

it('does not add UNITEL to wallet top-ups', async () => {
  render(<MemoryRouter initialEntries={['/payment-point?action=topup']}><Routes>
    <Route path="/payment-point" element={<PaymentPoint />} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Carregar' }));
  expect(await screen.findByText('AppyPay · Sandbox')).toBeInTheDocument();
  expect(screen.queryByText(copy.title)).not.toBeInTheDocument();
  expect(unitelCapabilities).not.toHaveBeenCalled();
});
