import { GatewayError, amountFromMinor, hashEvent, isMerchantRef, isUuid, object, publicAttempt, verifyCharge } from './massa-appypay.ts';
import type { Charge, GatewayAttempt, SandboxConfig } from './massa-appypay.ts';

export interface GatewayStore { rpc<T>(name: string, args: Record<string, unknown>): Promise<T> }
export interface GatewayTransport { create(attempt: GatewayAttempt): Promise<Charge>; get(id: string): Promise<Charge> }
export interface WebhookEvent {
  event_id: string | null; duplicate: boolean; attempt_id: string | null;
  processed_at?: string | null; rate_limited?: boolean;
  charge_id?: string | null; merchant_ref?: string | null;
}

/** Business orchestration shared by interactive checks, callbacks and reconciliation. */
export class MassaGatewayService {
  config: SandboxConfig;
  private store: GatewayStore;
  private gateway: GatewayTransport;
  constructor(config: SandboxConfig, store: GatewayStore, gateway: GatewayTransport) {
    this.config = config; this.store = store; this.gateway = gateway;
  }

  private record(attempt: GatewayAttempt, charge: Charge | null, state: string, issue: string | null = null, observedPaid = false) {
    return this.store.rpc<GatewayAttempt>('massa_gateway_record', {
      p_attempt_id: attempt.id, p_charge_id: charge?.id ?? attempt.provider_charge_id,
      p_state: state, p_code: charge?.code ?? null, p_issue: issue,
      p_reference: charge?.reference ?? null, p_entity: charge?.entity ?? null, p_due: charge?.dueAt ?? null,
      p_observed_paid: observedPaid,
    });
  }

  async create(actor: string, input: Record<string, unknown>) {
    if (!isUuid(input.requestId) || !['GPO', 'REF'].includes(String(input.method))) throw new GatewayError('invalid_request');
    const orderId = input.orderId == null ? null : input.orderId;
    if (orderId !== null && !isUuid(orderId)) throw new GatewayError('invalid_request');
    const amount = orderId ? null : input.amountMinor;
    if (!orderId) amountFromMinor(amount as number);
    const phone = input.method === 'GPO' ? input.phone : null;
    if (input.method === 'GPO' && (typeof phone !== 'string' || !/^90000000[0-3]$/.test(phone))) throw new GatewayError('invalid_test_phone');
    const attempt = await this.store.rpc<GatewayAttempt>('massa_gateway_prepare', {
      p_actor: actor, p_request_id: input.requestId, p_order_id: orderId, p_amount_minor: amount,
      p_method: input.method, p_phone: phone, p_merchant: this.config.merchant,
    });
    if (attempt.merchant !== this.config.merchant) throw new GatewayError('merchant_mismatch');
    if (!attempt.submit) return { attempt: publicAttempt(attempt), reused: true };
    let charge: Charge;
    try { charge = await this.gateway.create(attempt); }
    catch (error) {
      const known = error instanceof GatewayError;
      const uncertain = !known || error.uncertain;
      // The attempt already exists. Never convert an ambiguous financial POST into a retry.
      const saved = await this.record(attempt, null, uncertain ? 'uncertain' : 'failed', known ? error.code : 'creation_uncertain');
      return { attempt: publicAttempt(saved), reused: false };
    }
    const saved = await this.record(attempt, charge, charge.id && charge.state === 'pending' ? 'pending' : 'uncertain', charge.id ? null : 'awaiting_charge_id');
    if (!charge.id) return { attempt: publicAttempt(saved), reused: false };
    // A creation response, including code 100, is not sufficient to fulfil MASSA.
    const checked = await this.reconcileAttempt(saved, charge.id);
    return { attempt: publicAttempt(checked), reused: false };
  }

  async status(actor: string, input: Record<string, unknown>) {
    const ids = [input.attemptId, input.orderId, input.requestId].filter(value => value != null);
    if (!ids.length || !ids.every(isUuid)) throw new GatewayError('invalid_request');
    // The UI sends all known identifiers. Select once, then verify their agreement;
    // do not let a broad order lookup hide a mismatched request/attempt identity.
    const attemptId = typeof input.attemptId === 'string' ? input.attemptId.toLowerCase() : null;
    const requestId = typeof input.requestId === 'string' ? input.requestId.toLowerCase() : null;
    const orderId = typeof input.orderId === 'string' ? input.orderId.toLowerCase() : null;
    const attempt = await this.store.rpc<GatewayAttempt | null>('massa_gateway_get', {
      p_actor: actor, p_attempt_id: attemptId, p_request_id: attemptId ? null : requestId,
      p_order_id: attemptId || requestId ? null : orderId,
    });
    if (!attempt) return { attempt: null };
    if ((attemptId && attempt.id !== attemptId) || (requestId && attempt.request_id !== requestId) ||
        (orderId && attempt.order_id !== orderId)) throw new GatewayError('request_rejected');
    if (attempt.merchant !== this.config.merchant) throw new GatewayError('merchant_mismatch');
    if (attempt.state === 'confirmed') return { attempt: publicAttempt(attempt) };
    return { attempt: publicAttempt(await this.reconcileAttempt(attempt)) };
  }

  async reconcileAttempt(attempt: GatewayAttempt, chargeId: string | null = attempt.provider_charge_id, untrustedHint = false): Promise<GatewayAttempt> {
    if (attempt.merchant !== this.config.merchant) throw new GatewayError('merchant_mismatch');
    if (untrustedHint && attempt.provider_charge_id && attempt.provider_charge_id !== chargeId) throw new GatewayError('event_mismatch');
    if (attempt.state === 'confirmed') return attempt;
    if (!chargeId) return await this.record(attempt, null, 'uncertain', 'awaiting_charge_id');
    let charge: Charge;
    try { charge = await this.gateway.get(chargeId); }
    catch {
      // An unverified callback must not change the legitimate attempt, even when
      // the gateway is unavailable. Its durable inbox entry will be retried.
      if (untrustedHint) throw new GatewayError('query_unavailable');
      return await this.record(attempt, null, attempt.state === 'submitting' ? 'uncertain' : attempt.state, 'query_unavailable');
    }
    const sameIdentity = charge.id === chargeId && charge.merchantRef === attempt.merchant_ref &&
      (!attempt.provider_charge_id || attempt.provider_charge_id === chargeId);
    if (untrustedHint && !sameIdentity) throw new GatewayError('event_mismatch');
    try { verifyCharge(charge, attempt, chargeId, this.config.merchant); }
    catch {
      // Do not bind IDs, references or financial details from a mismatched charge.
      return await this.record(attempt, null, 'review', 'charge_mismatch', sameIdentity && charge.state === 'confirmed');
    }
    if (charge.state === 'confirmed') {
      return await this.store.rpc<GatewayAttempt>('massa_gateway_confirm', {
        p_attempt_id: attempt.id, p_charge_id: chargeId, p_merchant_ref: charge.merchantRef,
        p_amount_minor: charge.amountMinor, p_currency: charge.currency, p_method: charge.method,
      });
    }
    return await this.record(attempt, charge, charge.state, charge.state === 'review' ? 'unrecognised_status' : null);
  }

  async receiveEvent(input: Record<string, unknown>): Promise<WebhookEvent> {
    const chargeId = isUuid(input.id) ? input.id : null;
    const merchantRef = isMerchantRef(input.merchantTransactionId) ? input.merchantTransactionId : null;
    if (!chargeId || !merchantRef) throw new GatewayError('invalid_event');
    const rs = object(input.responseStatus);
    const code = /^\d{1,6}$/.test(String(rs.code)) ? Number(rs.code) : null;
    // Untrusted callback content is a hint only. Keep no raw body, phone or credentials.
    return await this.store.rpc<WebhookEvent>('massa_gateway_event', {
      p_event_hash: await hashEvent({ id: chargeId, merchantTransactionId: merchantRef, code }),
      p_merchant: this.config.merchant, p_charge_id: chargeId, p_merchant_ref: merchantRef, p_code: code,
    });
  }

  async processEvent(event: WebhookEvent, input: Record<string, unknown>): Promise<void> {
    if (!event.event_id || !event.attempt_id || !isUuid(input.id) || !isMerchantRef(input.merchantTransactionId)) return;
    try {
      const attempt = await this.store.rpc<GatewayAttempt | null>('massa_gateway_find', {
        p_merchant: this.config.merchant, p_charge_id: input.id, p_merchant_ref: input.merchantTransactionId,
      });
      if (!attempt || attempt.id !== event.attempt_id || attempt.merchant_ref !== input.merchantTransactionId ||
          (attempt.provider_charge_id && attempt.provider_charge_id !== input.id)) throw new GatewayError('event_mismatch');
      const checked = await this.reconcileAttempt(attempt, input.id, true);
      await this.store.rpc('massa_gateway_event_done', { p_event_id: event.event_id, p_issue: checked.issue_code });
    } catch (error) {
      const issue = error instanceof GatewayError ? error.code : 'processing_unavailable';
      try { await this.store.rpc('massa_gateway_event_done', { p_event_id: event.event_id, p_issue: issue }); } catch { /* Retry from the inbox. */ }
      // The durable event and the leased reconciliation queue remain available.
      // Never log callback payloads or gateway credentials.
    }
  }

  async reconcileBatch(input: Record<string, unknown>) {
    // A trusted operator can recover a lost POST response using a known portal charge ID.
    // The same GET/identity/amount checks apply; this never creates a charge.
    if (input.attemptId != null || input.chargeId != null) {
      if (!isUuid(input.attemptId) || !isUuid(input.chargeId)) throw new GatewayError('invalid_request');
      const attempt = await this.store.rpc<GatewayAttempt | null>('massa_gateway_find', {
        p_merchant: this.config.merchant, p_charge_id: null, p_merchant_ref: null, p_attempt_id: input.attemptId,
      });
      if (!attempt) throw new GatewayError('attempt_not_found');
      return { attempt: publicAttempt(await this.reconcileAttempt(attempt, input.chargeId)) };
    }
    // Keep each invocation bounded. Leases outlast this budget plus one GET with
    // token renewal. A later invocation resumes any unexamined leased items.
    const deadline = Date.now() + 45_000;
    const events = await this.store.rpc<WebhookEvent[]>('massa_gateway_events_due', {
      p_merchant: this.config.merchant, p_limit: 10, p_lease_seconds: 120,
    });
    let eventsExamined = 0;
    for (const event of events) {
      if (Date.now() >= deadline) break;
      await this.processEvent(event, { id: event.charge_id, merchantTransactionId: event.merchant_ref });
      eventsExamined++;
    }
    const attempts = Date.now() < deadline ? await this.store.rpc<GatewayAttempt[]>('massa_gateway_due', {
      p_merchant: this.config.merchant, p_limit: 10, p_lease_seconds: 120,
    }) : [];
    const result: Record<string, number> = {};
    let examined = 0;
    // Bounded sequential work: no surge of requests against a payment provider.
    for (const attempt of attempts) {
      if (Date.now() >= deadline) break;
      examined++;
      try {
        const checked = await this.reconcileAttempt(attempt);
        result[checked.state] = (result[checked.state] ?? 0) + 1;
      } catch { result.unavailable = (result.unavailable ?? 0) + 1; }
    }
    return { examined, eventsExamined, states: result, environment: 'sandbox' };
  }
}
