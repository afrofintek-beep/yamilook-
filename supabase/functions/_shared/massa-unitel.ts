/** UNITEL Money order-payment transport. Disabled until a provisioned sandbox is explicitly configured. */
export type UnitelState = 'submitting' | 'pending' | 'uncertain' | 'confirmed' | 'failed' | 'expired' | 'review';
export interface UnitelAttempt {
  id: string; request_id: string; order_id: string; actor_id: string; beneficiary_id: string;
  amount_minor: number; currency: 'AOA'; phone: string | null; merchant: string; merchant_ref: string;
  provider_conversation_id: string | null; provider_transaction_id: string | null;
  state: UnitelState; issue_code: string | null; provider_code: number | null;
  created_at: string; updated_at: string; submit?: boolean; observed_paid?: boolean;
}
export interface UnitelConfig {
  clientId: string; clientSecret: string; tokenUrl: string; apiBaseUrl: string;
  operator: string; securityCredential: string; merchant: string; posDeviceId: string; callbackUrl: string;
  allowedHosts: Set<string>; allowedUsers: Set<string>; allowedBeneficiaries: Set<string>;
  allowedPhones: Set<string>; allowedOrigins: Set<string>; reconcileToken: string; webhookToken?: string;
}
export interface UnitelAcceptance {
  merchantRef: string | null; conversationId: string | null;
  state: 'pending' | 'uncertain' | 'failed' | 'review'; code: number | null;
}
export interface UnitelQuery {
  /** The original reference used in this authenticated query, not an amount inferred from the provider. */
  merchantRef: string; conversationId: string | null; transactionId: string | null;
  state: 'pending' | 'uncertain' | 'confirmed' | 'failed' | 'expired' | 'review'; code: number | null;
  /** A mismatching Completed receipt is evidence for review, never permission to bind or fulfil. */
  observedPaid?: boolean;
}
export interface UnitelCallback {
  merchantRef: string; conversationId: string | null; transactionId: string | null; code: number | null;
}
export type Env = (key: string) => string | undefined;
const PRODUCTION_PROJECT = 'rfayqekonkovfbkwjjum';
export const MAX_MINOR = 100_000_000;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isMerchantRef = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
export const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const split = (value?: string) => (value ?? '').split(',').map(s => s.trim()).filter(Boolean);
const identifier = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value) ? value : null;
const providerId = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
const resultCode = (value: unknown): number | null => (typeof value === 'string' || typeof value === 'number') && /^\d{1,9}$/.test(String(value)) ? Number(value) : null;
const isPhone = (value: unknown): value is string => typeof value === 'string' && /^9\d{8}$/.test(value);
const unitelHost = (host: string) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+unitel\.co\.ao$/.test(host);
const asciiSecret = (value: string) => /^[\x21-\x7e]{1,4096}$/.test(value);

export class UnitelError extends Error {
  readonly code: string;
  readonly uncertain: boolean;
  constructor(code: string, uncertain = false) { super(code); this.name = 'UnitelError'; this.code = code; this.uncertain = uncertain; }
}

function cleanHttps(value: string): URL | null {
  if (!value || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127 || char === '\\')) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
        url.hostname.startsWith('[') || /^\d+(?:\.\d+)*$/.test(url.hostname) || /%|\/\//.test(url.pathname)) return null;
    return url;
  } catch { return null; }
}

function unitelUrl(value: string, hosts: Set<string>): URL | null {
  const url = cleanHttps(value);
  return url && unitelHost(url.hostname) && hosts.has(url.hostname) ? url : null;
}

export function allowedOrigins(env: Env): Set<string> {
  return new Set(split(env('MASSA_UNITEL_ALLOWED_ORIGINS')).filter(value => {
    const url = cleanHttps(value); return !!url && url.origin === value;
  }));
}

/** There is no default provider endpoint: the PDF does not identify a provisioned sandbox. */
export function loadSandboxConfig(env: Env): UnitelConfig | null {
  if (env('MASSA_UNITEL_ENABLED') !== 'sandbox' || env('MASSA_UNITEL_SANDBOX_CONFIRMED') !== 'true') return null;
  const ref = env('MASSA_UNITEL_SANDBOX_PROJECT_REF') ?? '';
  if (!/^[a-z]{20}$/.test(ref) || ref === PRODUCTION_PROJECT) return null;
  const supabase = cleanHttps(env('SUPABASE_URL') ?? '');
  if (!supabase || supabase.origin !== `https://${ref}.supabase.co` || supabase.pathname !== '/') return null;
  const hostValues = split(env('MASSA_UNITEL_ALLOWED_HOSTS'));
  if (!hostValues.length || !hostValues.every(unitelHost)) return null;
  const hosts = new Set(hostValues);
  const token = unitelUrl(env('MASSA_UNITEL_TOKEN_URL') ?? '', hosts);
  const base = unitelUrl(env('MASSA_UNITEL_API_BASE_URL') ?? '', hosts);
  const callback = env('MASSA_UNITEL_CALLBACK_URL') ?? '';
  if (!token || !base || callback !== `${supabase.origin}/functions/v1/massa-unitel-webhook`) return null;
  const clientId = env('MASSA_UNITEL_CLIENT_ID') ?? '';
  const clientSecret = env('MASSA_UNITEL_CLIENT_SECRET') ?? '';
  const operator = env('MASSA_UNITEL_OPERATOR') ?? '';
  const securityCredential = env('MASSA_UNITEL_SECURITY_CREDENTIAL') ?? '';
  const merchant = env('MASSA_UNITEL_MERCHANT_ID') ?? '';
  const posDeviceId = env('MASSA_UNITEL_POS_DEVICE_ID') ?? '';
  const users = split(env('MASSA_UNITEL_ALLOWED_USERS'));
  const beneficiaries = split(env('MASSA_UNITEL_ALLOWED_BENEFICIARIES'));
  const phones = split(env('MASSA_UNITEL_ALLOWED_PHONES'));
  const origins = split(env('MASSA_UNITEL_ALLOWED_ORIGINS'));
  const safeOrigins = allowedOrigins(env);
  const reconcileToken = env('MASSA_UNITEL_RECONCILE_TOKEN') ?? '';
  const webhookToken = env('MASSA_UNITEL_WEBHOOK_TOKEN') ?? '';
  if (!asciiSecret(clientId) || clientId.includes(':') || !asciiSecret(clientSecret) || !asciiSecret(securityCredential) ||
      !identifier(operator) || !identifier(merchant) || !identifier(posDeviceId) ||
      !users.length || !users.every(isUuid) || !beneficiaries.length || !beneficiaries.every(isUuid) ||
      !phones.length || !phones.every(isPhone) || !origins.length || origins.some(value => !safeOrigins.has(value)) ||
      reconcileToken.length < 32 || !asciiSecret(reconcileToken) || (webhookToken && (webhookToken.length < 32 || !asciiSecret(webhookToken)))) return null;
  return { clientId, clientSecret, operator, securityCredential, merchant, posDeviceId,
    tokenUrl: token.href, apiBaseUrl: base.href.replace(/\/$/, ''), callbackUrl: callback,
    allowedHosts: hosts, allowedUsers: new Set(users.map(value => value.toLowerCase())),
    allowedBeneficiaries: new Set(beneficiaries.map(value => value.toLowerCase())), allowedPhones: new Set(phones),
    allowedOrigins: safeOrigins, reconcileToken, webhookToken };
}

/** Monetary requests use exact decimal strings; the query response does not contain an amount. */
export function amountFromMinor(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MINOR) throw new UnitelError('invalid_amount');
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

export function normalizeAcceptance(value: unknown, attempt: UnitelAttempt): UnitelAcceptance {
  const data = object(object(value).Response);
  const merchantRef = isMerchantRef(data.OriginatorConversationID) ? data.OriginatorConversationID : null;
  const conversationId = providerId(data.ConversationID);
  const code = resultCode(data.ResponseCode);
  const matches = merchantRef === attempt.merchant_ref && !!conversationId;
  return { merchantRef, conversationId: matches ? conversationId : null, code,
    state: !matches ? 'review' : code === 0 && resultCode(data.ServiceStatus) === 0 ? 'pending' : 'uncertain' };
}

/** Scoped to a server-built OriginalConversationID query. Never use this on callback bodies. */
export function normalizeQuery(value: unknown, attempt: UnitelAttempt, queryRef: string): UnitelQuery {
  const envelope = object(value);
  const primary = object(envelope.QueryTransStatusRs);
  const error = object(envelope.QueryTransactionStatusResult);
  const ambiguous = Object.hasOwn(envelope, 'QueryTransStatusRs') && Object.hasOwn(envelope, 'QueryTransactionStatusResult');
  const data = Object.hasOwn(envelope, 'QueryTransStatusRs') ? primary : error;
  const transaction = object(data.Transaction);
  const code = resultCode(data.ResultCode);
  const receipt = providerId(transaction.ReceiptNumber);
  const observedPaid = resultCode(data.ResultType) === 0 && code === 0 && transaction.TransactionStatus === 'Completed' && receipt !== null;
  const echoMismatch = (data.OriginatorConversationID != null && data.OriginatorConversationID !== queryRef) ||
    (data.OriginalConversationID != null && data.OriginalConversationID !== attempt.merchant_ref) ||
    (transaction.OriginalConversationID != null && transaction.OriginalConversationID !== attempt.merchant_ref) ||
    (attempt.provider_transaction_id != null && receipt != null && attempt.provider_transaction_id !== receipt);
  let state: UnitelQuery['state'] = 'uncertain';
  if (ambiguous || echoMismatch) state = 'review';
  else if (resultCode(data.ResultType) === 0 && code === 0) {
    if (transaction.TransactionStatus === 'Completed' && receipt) state = 'confirmed';
    else if (transaction.TransactionStatus === 'Pending' || transaction.TransactionStatus === 'Processing') state = 'pending';
    else state = 'review';
  }
  // ResultCode=3011 means the lookup failed; it does not prove the original payment failed.
  // A receipt on a review result is retained ONLY as evidence; bind it only when state=confirmed.
  return { merchantRef: attempt.merchant_ref, conversationId: attempt.provider_conversation_id,
    transactionId: observedPaid ? receipt : null, state, code, observedPaid };
}

/** A callback contains only hints. Its ResultCode/TransactionID cannot confirm a payment. */
export function parseCallback(value: unknown): UnitelCallback | null {
  const envelope = object(value);
  const keys = ['ResultBuyGoods', 'Result'].filter(key => Object.hasOwn(envelope, key));
  if (keys.length !== 1) return null;
  const data = object(envelope[keys[0]]);
  if (!isMerchantRef(data.OriginatorConversationID)) return null;
  const conversationId = providerId(data.ConversationID);
  if (!conversationId) return null;
  return { merchantRef: data.OriginatorConversationID, conversationId,
    transactionId: providerId(object(data.TransactionResult).TransactionID), code: resultCode(data.ResultCode) };
}

export async function readJsonBody(input: Request | Response, limit = 65_536): Promise<Record<string, unknown>> {
  const reader = input.body?.getReader();
  if (!reader) throw new UnitelError('invalid_json');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new UnitelError('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder().decode(joined));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return value;
  } catch { throw new UnitelError('invalid_json'); }
}

export class SandboxUnitelMoney {
  private cached: { token: string; until: number } | null = null;
  private obtaining: Promise<string> | null = null;
  private config: UnitelConfig;
  private fetcher: typeof fetch;
  private clock: () => number;
  constructor(config: UnitelConfig, fetcher: typeof fetch = fetch, clock: () => number = Date.now) {
    this.config = config; this.fetcher = fetcher; this.clock = clock;
    const callback = cleanHttps(config.callbackUrl);
    if (!config.allowedHosts?.size || ![...config.allowedHosts].every(unitelHost) ||
        !unitelUrl(config.tokenUrl, config.allowedHosts) || !unitelUrl(config.apiBaseUrl, config.allowedHosts) ||
        !callback || !/^[a-z]{20}\.supabase\.co$/.test(callback.hostname) || callback.hostname.startsWith(`${PRODUCTION_PROJECT}.`) ||
        callback.port || callback.pathname !== '/functions/v1/massa-unitel-webhook') throw new UnitelError('invalid_configuration');
  }

  private validateAttempt(attempt: UnitelAttempt, forCreation = false) {
    if (!isUuid(attempt.id) || !isUuid(attempt.request_id) || !isUuid(attempt.order_id) ||
        !isUuid(attempt.actor_id) || !isUuid(attempt.beneficiary_id) || attempt.currency !== 'AOA' ||
        attempt.merchant !== this.config.merchant || !isMerchantRef(attempt.merchant_ref)) throw new UnitelError('invalid_attempt');
    amountFromMinor(attempt.amount_minor);
    // Removing a pilot participant must not make an already submitted payment unqueryable.
    // The service authorizes access and SQL decides whether verified evidence can fulfil the order.
    if (forCreation) {
      if (!this.config.allowedUsers.has(attempt.actor_id) || !this.config.allowedBeneficiaries.has(attempt.beneficiary_id)) throw new UnitelError('invalid_attempt');
      if (!isPhone(attempt.phone) || !this.config.allowedPhones.has(attempt.phone)) throw new UnitelError('invalid_test_phone');
    }
  }

  private timestamp(): string {
    // Explicit Angola local time (UTC+1); no host timezone dependency or DST.
    return new Date(this.clock() + 3_600_000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  }

  private initiator() {
    return { IdentifierType: 12, Identifier: this.config.operator,
      SecurityCredential: this.config.securityCredential, ShortCode: this.config.merchant };
  }

  private async token(): Promise<string> {
    if (this.cached && this.clock() < this.cached.until) return this.cached.token;
    if (this.obtaining) return await this.obtaining;
    this.obtaining = (async () => {
      let response: Response;
      try {
        response = await this.fetcher(this.config.tokenUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Basic ${btoa(`${this.config.clientId}:${this.config.clientSecret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({ grant_type: 'client_credentials' }) });
      } catch { throw new UnitelError('authentication_unavailable'); }
      if (!response.ok) throw new UnitelError('authentication_rejected');
      let data: Record<string, unknown>;
      try { data = await readJsonBody(response); } catch { throw new UnitelError('authentication_invalid'); }
      const seconds = Number(data.expires_in);
      if (typeof data.access_token !== 'string' || !/^[\x21-\x7e]{1,16384}$/.test(data.access_token) ||
          String(data.token_type).toLowerCase() !== 'bearer' || !Number.isFinite(seconds) || seconds < 60 || seconds > 86400) throw new UnitelError('authentication_invalid');
      this.cached = { token: data.access_token, until: this.clock() + (seconds - 30) * 1000 };
      return this.cached.token;
    })();
    try { return await this.obtaining; } finally { this.obtaining = null; }
  }

  async create(attempt: UnitelAttempt): Promise<UnitelAcceptance> {
    this.validateAttempt(attempt, true);
    const token = await this.token();
    const body = { BuyGoodRec: { Timestamp: this.timestamp(), OriginatorConversationID: attempt.merchant_ref,
      IdentityRec: { Initiator: this.initiator(), PrimaryParty: { IdentifierType: 1, Identifier: attempt.phone },
        ReceiverParty: { IdentifierType: 4, Identifier: this.config.merchant } },
      TransactionRequest: { Parameters: { Amount: amountFromMinor(attempt.amount_minor), Currency: 'AOA' } },
      ReferenceData: { ReferenceItem: [{ Key: 'POSDeviceID', Value: this.config.posDeviceId }, { Key: 'Callback', Value: this.config.callbackUrl }] } } };
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.apiBaseUrl}/buyGoods_async`, { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body) });
    } catch { throw new UnitelError('creation_uncertain', true); }
    // Even a token rejection is not retried: a financial request is sent at most once.
    if (!response.ok) throw new UnitelError(response.status === 401 || response.status === 403 ? 'creation_rejected' : 'creation_uncertain', !(response.status === 401 || response.status === 403));
    try { return normalizeAcceptance(await readJsonBody(response), attempt); }
    catch { throw new UnitelError('creation_uncertain', true); }
  }

  async query(attempt: UnitelAttempt): Promise<UnitelQuery> {
    this.validateAttempt(attempt);
    // This query needs no callback receipt. It uses the ORIGINAL persisted creation reference.
    for (let retry = 0; retry < 2; retry++) {
      const token = await this.token();
      const queryRef = `MUQ_${crypto.randomUUID().replace(/-/g, '')}`;
      const body = { QueryTransactionStatus: { Timestamp: this.timestamp(), OriginatorConversationID: queryRef,
        IdentityRec: { Initiator: this.initiator() },
        QueryTransactionStatusRequest: { OriginalConversationID: attempt.merchant_ref }, Remark: 'MASSA sandbox order status' } };
      let response: Response;
      try {
        response = await this.fetcher(`${this.config.apiBaseUrl}/queryTransactionStatus_sync`, { method: 'POST', redirect: 'error',
          signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body) });
      } catch { throw new UnitelError('query_unavailable'); }
      if (response.status === 401 && retry === 0) { this.cached = null; continue; }
      if (!response.ok) throw new UnitelError('query_unavailable');
      try { return normalizeQuery(await readJsonBody(response), attempt, queryRef); }
      catch { throw new UnitelError('query_unavailable'); }
    }
    throw new UnitelError('query_unavailable');
  }
}

export async function equalSecret(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected || provided.length > 4096) return false;
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; return diff === 0;
}
export async function hashEvent(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

/** Explicit projection; no telephone, merchant/operator identity, secrets or raw provider body. */
export function publicAttempt(attempt: UnitelAttempt | null) {
  if (!attempt) return null;
  return { id: attempt.id, request_id: attempt.request_id, order_id: attempt.order_id,
    purpose: 'order' as const, method: 'UNITEL_MONEY' as const, amount_minor: attempt.amount_minor, currency: attempt.currency,
    state: attempt.state, provider_conversation_id: attempt.provider_conversation_id, provider_transaction_id: attempt.provider_transaction_id,
    issue_code: attempt.issue_code, created_at: attempt.created_at, updated_at: attempt.updated_at };
}
