import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UnitelMoneySandbox } from './UnitelMoneySandbox';
import { unitelAction, unitelCapabilities, unitelStorageKey, type UnitelAttempt, type UnitelRequest } from './unitel-api';
import { UNITEL_COPY } from './unitel-labels';
import { useUiLocale } from '@/i18n/ui-copy';

vi.mock('@/i18n/ui-copy', () => ({ useUiLocale: vi.fn(() => 'pt') }));
vi.mock('./unitel-api', async original => ({
  ...await original<typeof import('./unitel-api')>(), unitelAction: vi.fn(), unitelCapabilities: vi.fn(),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const attemptId = '44444444-4444-4444-8444-444444444444';
const otherId = '55555555-5555-4555-8555-555555555555';
const phones = ['+244900000021', '+244900000022'];
const api = vi.mocked(unitelAction);
const storage = new Map<string, string>();
const copy = UNITEL_COPY.pt;
const pending = (overrides: Partial<UnitelAttempt> = {}): UnitelAttempt => ({
  id: attemptId, request_id: requestId, order_id: orderId, amount_minor: 1250,
  currency: 'AOA', method: 'UNITEL_MONEY', purpose: 'order', state: 'pending',
  created_at: '2026-11-25T09:00:00Z', updated_at: '2026-11-25T09:00:00Z', ...overrides,
});
const props = { userId, orderId, amountMinor: 1250 };

beforeEach(() => {
  storage.clear(); vi.clearAllMocks(); api.mockReset();
  vi.mocked(useUiLocale).mockReturnValue('pt');
  vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => { storage.set(key, value); });
  vi.mocked(localStorage.removeItem).mockImplementation(key => { storage.delete(key); });
  vi.mocked(unitelCapabilities).mockResolvedValue({ enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones: phones });
  api.mockResolvedValue({ attempt: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('keeps UNITEL absent while capabilities are disabled or unavailable', async () => {
  vi.mocked(unitelCapabilities).mockResolvedValue({ enabled: false, environment: 'sandbox', methods: [] });
  const { container } = render(<UnitelMoneySandbox {...props} />);
  await waitFor(() => expect(unitelCapabilities).toHaveBeenCalledOnce());
  expect(container).toBeEmptyDOMElement();
  expect(api).not.toHaveBeenCalled();
});

it('uses readable English fallback for a locale without UNITEL translations', async () => {
  vi.mocked(useUiLocale).mockReturnValue('fr');
  render(<UnitelMoneySandbox {...props} />);
  expect(await screen.findByRole('button', { name: UNITEL_COPY.en.start })).toBeInTheDocument();
  expect(screen.getByLabelText(UNITEL_COPY.en.phone)).toBeInTheDocument();
  expect(screen.queryByText(/massaUnitel\./)).not.toBeInTheDocument();
});

it('offers only server-approved accounts, persists before create, and prevents double clicks', async () => {
  let finish!: (result: { attempt: UnitelAttempt }) => void;
  let sent!: UnitelRequest;
  api.mockImplementation(input => {
    if (input.action === 'status') return Promise.resolve({ attempt: null });
    sent = input;
    expect(JSON.parse(storage.get(unitelStorageKey(userId, orderId))!)).toEqual({ requestId: input.requestId, orderId, phone: phones[1] });
    return new Promise(resolve => { finish = resolve; });
  });
  const blocked = vi.fn();
  render(<UnitelMoneySandbox {...props} onBlockedChange={blocked} />);
  const create = await screen.findByRole('button', { name: copy.start });
  await waitFor(() => expect(create).toBeEnabled());
  expect(screen.getAllByRole('option').map(option => (option as HTMLOptionElement).value)).toEqual(phones);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(copy.phone), { target: { value: phones[1] } });
  fireEvent.click(create); fireEvent.click(create);
  expect(api.mock.calls.filter(([input]) => input.action === 'create')).toHaveLength(1);
  expect(sent).toEqual({ action: 'create', requestId: expect.any(String), orderId, phone: phones[1] });
  expect(blocked).toHaveBeenLastCalledWith(true);
  await act(async () => { finish({ attempt: pending({ request_id: sent.requestId }) }); });
  expect(screen.getByText(copy.states.pending)).toBeInTheDocument();
  expect(screen.queryByLabelText(copy.phone)).not.toBeInTheDocument();
  expect(screen.queryByText(phones[1])).not.toBeInTheDocument();
});

it('restores a lost response by the saved request and never automatically resubmits', async () => {
  api.mockImplementation(async input => {
    if (input.action === 'create') throw new Error('network');
    return { attempt: null };
  });
  const first = render(<UnitelMoneySandbox {...props} />);
  const create = await screen.findByRole('button', { name: copy.start });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  expect(await screen.findByText(copy.states.uncertain)).toBeInTheDocument();
  const sent = api.mock.calls.find(([input]) => input.action === 'create')![0] as UnitelRequest;
  expect(screen.queryByRole('button', { name: copy.retry })).not.toBeInTheDocument();
  first.unmount();
  api.mockResolvedValue({ attempt: pending({ request_id: sent.requestId }) });
  render(<UnitelMoneySandbox {...props} />);
  expect(await screen.findByText(copy.states.pending)).toBeInTheDocument();
  expect(api).toHaveBeenLastCalledWith({ action: 'status', requestId: sent.requestId });
  expect(api.mock.calls.filter(([input]) => input.action === 'create')).toHaveLength(1);
});

it('retries only the same saved request after an authoritative miss', async () => {
  const saved = { requestId, orderId, phone: phones[1] };
  storage.set(unitelStorageKey(userId, orderId), JSON.stringify(saved));
  render(<UnitelMoneySandbox {...props} />);
  const retry = await screen.findByRole('button', { name: copy.retry });
  expect(api).toHaveBeenLastCalledWith({ action: 'status', requestId });
  api.mockResolvedValue({ attempt: pending() });
  fireEvent.click(retry);
  await waitFor(() => expect(api).toHaveBeenLastCalledWith({ action: 'create', ...saved }));
  expect(await screen.findByText(copy.states.pending)).toBeInTheDocument();
});

it('does not submit when storage is unavailable or no approved account is supplied', async () => {
  vi.mocked(localStorage.setItem).mockImplementationOnce(() => { throw new Error('storage denied'); });
  const first = render(<UnitelMoneySandbox {...props} />);
  const create = await screen.findByRole('button', { name: copy.start });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  expect(await screen.findByText(copy.storageError)).toBeInTheDocument();
  expect(api.mock.calls.some(([input]) => input.action === 'create')).toBe(false);
  first.unmount();
  vi.mocked(unitelCapabilities).mockResolvedValue({ enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'] });
  render(<UnitelMoneySandbox {...props} />);
  expect(await screen.findByText(copy.noPhones)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: copy.start })).not.toBeInTheDocument();
});

it('lets the seller inspect an attempt without creating or displaying the payer phone', async () => {
  api.mockResolvedValue({ attempt: pending({ state: 'uncertain' }) });
  render(<UnitelMoneySandbox {...props} readOnly />);
  expect(await screen.findByText(copy.states.uncertain)).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Criar|Novo teste|Repetir/ })).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledWith({ action: 'status', orderId });
  fireEvent.click(screen.getByRole('button', { name: copy.check }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith({ action: 'status', attemptId }));
});

it.each([{ order_id: otherId }, { request_id: otherId }, { amount_minor: 2500 }])(
  'never confirms a response that mismatches the persisted request/order/amount: %j', async changes => {
    storage.set(unitelStorageKey(userId, orderId), JSON.stringify({ requestId, orderId, phone: phones[0] }));
    api.mockResolvedValue({ attempt: pending({ state: 'confirmed', ...changes }) });
    const confirmed = vi.fn(); const blocked = vi.fn();
    render(<UnitelMoneySandbox {...props} onConfirmed={confirmed} onBlockedChange={blocked} />);
    expect(await screen.findByText(copy.invalidResponse)).toBeInTheDocument();
    expect(confirmed).not.toHaveBeenCalled();
    expect(blocked).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText(copy.states.confirmed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.retry })).not.toBeInTheDocument();
  },
);

it('keeps confirmation final, refreshes once, and permits status inspection while another provider blocks creation', async () => {
  const confirmed = vi.fn().mockRejectedValue(new Error('receipt refresh offline'));
  api.mockResolvedValue({ attempt: pending() });
  render(<UnitelMoneySandbox {...props} canCreate={false} onConfirmed={confirmed} />);
  expect(await screen.findByText(copy.states.pending)).toBeInTheDocument();
  api.mockResolvedValue({ attempt: pending({ state: 'confirmed' }) });
  fireEvent(window, new Event('online'));
  expect(await screen.findByText(copy.states.confirmed)).toBeInTheDocument();
  await waitFor(() => expect(confirmed).toHaveBeenCalledOnce());
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
  expect(confirmed).toHaveBeenCalledOnce();
  api.mockResolvedValue({ attempt: null });
  fireEvent.click(screen.getByRole('button', { name: copy.check }));
  expect(await screen.findByText(copy.invalidResponse)).toBeInTheDocument();
  expect(screen.getByText(copy.states.confirmed)).toBeInTheDocument();
  expect(api.mock.calls.some(([input]) => input.action === 'create')).toBe(false);
  expect(screen.queryByRole('button', { name: copy.newTest })).not.toBeInTheDocument();
});
