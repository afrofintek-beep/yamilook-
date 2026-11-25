import { UnitelError, hashEvent, isUuid, parseCallback, publicAttempt } from './massa-unitel.ts';
import type { UnitelAcceptance, UnitelAttempt, UnitelConfig, UnitelQuery, UnitelState } from './massa-unitel.ts';

export interface UnitelStore { rpc<T>(name: string, args: Record<string, unknown>): Promise<T> }
export interface UnitelTransport {
  create(attempt: UnitelAttempt): Promise<UnitelAcceptance>;
  query(attempt: UnitelAttempt): Promise<UnitelQuery>;
}
export interface UnitelWebhookEvent {
  event_id: string | null; attempt_id: string | null; duplicate: boolean;
  processed_at?: string | null; rate_limited?: boolean;
  merchant_ref: string; conversation_id: string | null; transaction_id: string | null;
}

// These failures prove that authentication/validation failed before a payment
// instruction was sent, or that the payment endpoint rejected authentication.
const SAFE_CREATION_FAILURES = new Set(['invalid_attempt', 'invalid_amount', 'invalid_test_phone',
  'authentication_unavailable', 'authentication_rejected', 'authentication_invalid', 'creation_rejected']);

/** Only an authenticated status query can reach the financial confirmation RPC. */
export class MassaUnitelService {
  private config: UnitelConfig;
  private store: UnitelStore;
  private gateway: UnitelTransport;
  constructor(config: UnitelConfig, store: UnitelStore, gateway: UnitelTransport) {
    this.config = config; this.store = store; this.gateway = gateway;
  }

  private record(attempt: UnitelAttempt, state: Exclude<UnitelState, 'submitting' | 'confirmed'>,
    issue: string | null = null, evidence: { conversationId?: string | null; transactionId?: string | null; code?: number | null; observedPaid?: boolean; bindIdentity?: boolean } = {}) {
    return this.store.rpc<UnitelAttempt>('massa_unitel_record', {
      p_attempt_id: attempt.id, p_state: state, p_conversation_id: evidence.conversationId ?? null,
      p_transaction_id: evidence.transactionId ?? null, p_code: evidence.code ?? null,
      p_issue: issue, p_observed_paid: evidence.observedPaid === true, p_bind_identity: evidence.bindIdentity !== false,
    });
  }

  async create(actor: string, input: Record<string, unknown>) {
    if (!isUuid(actor) || !this.config.allowedUsers.has(actor)) throw new UnitelError('access_denied');
    if (!isUuid(input.requestId) || !isUuid(input.orderId) ||
      ['amount', 'amountMinor', 'beneficiaryId', 'currency', 'purpose'].some(key => key in input)) throw new UnitelError('invalid_request');
    if (typeof input.phone !== 'string' || !this.config.allowedPhones.has(input.phone)) throw new UnitelError('invalid_test_phone');
    const attempt = await this.store.rpc<UnitelAttempt>('massa_unitel_prepare', {
      p_actor: actor, p_request_id: input.requestId.toLowerCase(), p_order_id: input.orderId.toLowerCase(),
      p_phone: input.phone, p_merchant: this.config.merchant,
      p_allowed_beneficiaries: [...this.config.allowedBeneficiaries],
    });
    if (attempt.merchant !== this.config.merchant) throw new UnitelError('merchant_mismatch');
    if (!attempt.submit) return { attempt: publicAttempt(attempt), reused: true };
    let accepted: UnitelAcceptance;
    try { accepted = await this.gateway.create(attempt); }
    catch (error) {
      const known = error instanceof UnitelError;
      const definitive = known && !error.uncertain && SAFE_CREATION_FAILURES.has(error.code);
      const saved = await this.record(attempt, definitive ? 'failed' : 'uncertain', known ? error.code : 'creation_uncertain');
      return { attempt: publicAttempt(saved), reused: false };
    }
    const matches = accepted.merchantRef === attempt.merchant_ref && !!accepted.conversationId;
    const state = matches ? accepted.state : 'review';
    const saved = await this.record(attempt, state, !matches ? 'acceptance_mismatch' :
      state === 'pending' ? null : 'acceptance_unresolved', {
      conversationId: matches ? accepted.conversationId : null, code: accepted.code,
    });
    // Acceptance is never settlement. The callback, status action or scheduled
    // worker will query the ORIGINAL stored reference, even if no reply arrived.
    return { attempt: publicAttempt(saved), reused: false };
  }

  async status(actor: string, input: Record<string, unknown>) {
    if (!isUuid(actor) || !this.config.allowedUsers.has(actor)) throw new UnitelError('access_denied');
    const selectors = ['attemptId', 'orderId', 'requestId'].filter(key => input[key] != null);
    if (selectors.length !== 1 || !isUuid(input[selectors[0]])) throw new UnitelError('invalid_request');
    const key = selectors[0];
    const id = (input[key] as string).toLowerCase();
    const attempt = await this.store.rpc<UnitelAttempt | null>('massa_unitel_get', {
      p_actor: actor, p_attempt_id: key === 'attemptId' ? id : null,
      p_order_id: key === 'orderId' ? id : null, p_request_id: key === 'requestId' ? id : null,
    });
    if (!attempt) return { attempt: null };
    if ((key === 'attemptId' && attempt.id !== id) || (key === 'orderId' && attempt.order_id !== id) ||
      (key === 'requestId' && attempt.request_id !== id)) throw new UnitelError('request_rejected');
    return { attempt: publicAttempt(await this.reconcileAttempt(attempt)) };
  }

  async reconcileAttempt(attempt: UnitelAttempt, fromEvent = false): Promise<UnitelAttempt> {
    if (attempt.merchant !== this.config.merchant) throw new UnitelError('merchant_mismatch');
    if (attempt.state === 'confirmed') return attempt;
    if (!fromEvent && attempt.state === 'failed' && !attempt.observed_paid && SAFE_CREATION_FAILURES.has(attempt.issue_code ?? '')) return attempt;
    let query: UnitelQuery;
    try { query = await this.gateway.query(attempt); }
    catch {
      // An untrusted notification must not change the attempt when the provider
      // is unavailable. The durable inbox and the attempt queue can retry queries.
      if (fromEvent) throw new UnitelError('query_unavailable');
      return await this.record(attempt, attempt.state === 'submitting' ? 'uncertain' : attempt.state, 'query_unavailable');
    }
    const matches = query.merchantRef === attempt.merchant_ref &&
      (!attempt.provider_conversation_id || !query.conversationId || query.conversationId === attempt.provider_conversation_id);
    if (!matches) return await this.record(attempt, 'review', 'query_mismatch', {
      transactionId: query.observedPaid ? query.transactionId : null, observedPaid: query.observedPaid, bindIdentity: false,
    });
    if (query.state === 'confirmed' && query.transactionId) {
      return await this.store.rpc<UnitelAttempt>('massa_unitel_confirm', {
        p_attempt_id: attempt.id, p_transaction_id: query.transactionId, p_merchant_ref: attempt.merchant_ref,
      });
    }
    const state = query.state === 'confirmed' ? 'review' : query.state;
    return await this.record(attempt, state, state === 'review' ? 'query_requires_review' :
      state === 'uncertain' ? 'query_unresolved' : null, {
      // Only the receipt from an authenticated query can become audit evidence.
      // The SQL record RPC keeps conflicting evidence separate from canonical IDs.
      transactionId: query.observedPaid ? query.transactionId : null,
      code: query.code, observedPaid: query.observedPaid, bindIdentity: state !== 'review',
    });
  }

  async receiveEvent(input: Record<string, unknown>): Promise<UnitelWebhookEvent> {
    const hint = parseCallback(input);
    if (!hint) throw new UnitelError('invalid_event');
    const event = await this.store.rpc<UnitelWebhookEvent>('massa_unitel_event', {
      p_event_hash: await hashEvent(hint), p_merchant: this.config.merchant,
      p_merchant_ref: hint.merchantRef, p_conversation_id: hint.conversationId,
      p_transaction_id: hint.transactionId, p_code: hint.code,
    });
    // Persist only identifiers and code. No raw callback, customer phone or PIN.
    return { ...event, merchant_ref: hint.merchantRef, conversation_id: hint.conversationId, transaction_id: hint.transactionId };
  }

  async processEvent(event: UnitelWebhookEvent): Promise<void> {
    if (!event.event_id || !event.attempt_id) return;
    try {
      const attempt = await this.store.rpc<UnitelAttempt | null>('massa_unitel_find', {
        p_merchant: this.config.merchant, p_merchant_ref: event.merchant_ref,
        p_conversation_id: event.conversation_id, p_transaction_id: event.transaction_id,
        p_attempt_id: event.attempt_id,
      });
      if (!attempt || attempt.id !== event.attempt_id || attempt.merchant_ref !== event.merchant_ref ||
        (attempt.provider_conversation_id && attempt.provider_conversation_id !== event.conversation_id) ||
        (attempt.provider_transaction_id && event.transaction_id && attempt.provider_transaction_id !== event.transaction_id)) throw new UnitelError('event_mismatch');
      const checked = await this.reconcileAttempt(attempt, true);
      await this.store.rpc('massa_unitel_event_done', { p_event_id: event.event_id, p_issue: checked.issue_code });
    } catch (error) {
      const issue = error instanceof UnitelError ? error.code : 'processing_unavailable';
      try { await this.store.rpc('massa_unitel_event_done', { p_event_id: event.event_id, p_issue: issue }); } catch { /* Durable inbox survives. */ }
    }
  }

  async reconcileBatch(input: Record<string, unknown>) {
    if (input.attemptId != null) {
      if (!isUuid(input.attemptId)) throw new UnitelError('invalid_request');
      const attempt = await this.store.rpc<UnitelAttempt | null>('massa_unitel_find', {
        p_merchant: this.config.merchant, p_attempt_id: input.attemptId.toLowerCase(),
      });
      if (!attempt) throw new UnitelError('attempt_not_found');
      return { attempt: publicAttempt(await this.reconcileAttempt(attempt)) };
    }
    const deadline = Date.now() + 45_000;
    const events = await this.store.rpc<UnitelWebhookEvent[]>('massa_unitel_events_due', {
      p_merchant: this.config.merchant, p_limit: 10, p_lease_seconds: 120,
    });
    let eventsExamined = 0;
    for (const event of events) {
      if (Date.now() >= deadline) break;
      await this.processEvent(event); eventsExamined++;
    }
    const attempts = Date.now() < deadline ? await this.store.rpc<UnitelAttempt[]>('massa_unitel_due', {
      p_merchant: this.config.merchant, p_limit: 10, p_lease_seconds: 120,
    }) : [];
    const states: Record<string, number> = {};
    let examined = 0;
    for (const attempt of attempts) {
      if (Date.now() >= deadline) break;
      examined++;
      try {
        const checked = await this.reconcileAttempt(attempt);
        states[checked.state] = (states[checked.state] ?? 0) + 1;
      } catch { states.unavailable = (states.unavailable ?? 0) + 1; }
    }
    return { examined, eventsExamined, states, environment: 'sandbox' };
  }
}
