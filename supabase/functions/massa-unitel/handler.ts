import { UnitelError, equalSecret, isUuid, readJsonBody } from '../_shared/massa-unitel.ts';
import type { UnitelConfig } from '../_shared/massa-unitel.ts';
import { MassaUnitelService } from '../_shared/massa-unitel-service.ts';
import type { UnitelStore, UnitelTransport } from '../_shared/massa-unitel-service.ts';

export interface UnitelHandlerDependencies {
  config: UnitelConfig | null; origins: Set<string>; store: UnitelStore; gateway: UnitelTransport;
  actor(request: Request): Promise<string | null>;
  defer(task: Promise<void>): void;
}

export function createUnitelHandlers(deps: UnitelHandlerDependencies) {
  const service = deps.config ? new MassaUnitelService(deps.config, deps.store, deps.gateway) : null;
  function response(request: Request, body: unknown, status = 200) {
    const origin = request.headers.get('Origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
    if (origin && deps.origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return new Response(JSON.stringify(body), { status, headers });
  }
  function failure(request: Request, error: unknown) {
    const code = error instanceof UnitelError ? error.code : 'service_unavailable';
    const status = code === 'unauthenticated' ? 401 : code === 'access_denied' ? 403 :
      ['invalid_request', 'invalid_amount', 'invalid_test_phone', 'invalid_event', 'invalid_json', 'body_too_large'].includes(code) ? 400 :
      ['request_rejected', 'merchant_mismatch', 'attempt_not_found'].includes(code) ? 409 : 503;
    return response(request, { error: { code }, environment: 'sandbox' }, status);
  }
  function before(request: Request, cors: boolean) {
    const origin = request.headers.get('Origin');
    if (cors && origin && !deps.origins.has(origin)) return response(request, { error: { code: 'access_denied' } }, 403);
    if (request.method === 'OPTIONS' && cors) return response(request, {});
    if (request.method !== 'POST') return response(request, { error: { code: 'method_not_allowed' } }, 405);
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return response(request, { error: { code: 'invalid_request' } }, 415);
    return null;
  }
  return {
    async user(request: Request) {
      const early = before(request, true); if (early) return early;
      try {
        const input = await readJsonBody(request, 8192);
        if (!service || !deps.config) {
          if (input.action === 'capabilities') return response(request, { enabled: false, environment: 'sandbox', methods: [] });
          throw new UnitelError('integration_disabled');
        }
        const actor = await deps.actor(request);
        if (!actor || !isUuid(actor)) throw new UnitelError('unauthenticated');
        if (!deps.config.allowedUsers.has(actor)) {
          if (input.action === 'capabilities') return response(request, { enabled: false, environment: 'sandbox', methods: [] });
          throw new UnitelError('access_denied');
        }
        if (input.action === 'capabilities') return response(request, {
          enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones: [...deps.config.allowedPhones],
        });
        if (input.action === 'create') return response(request, await service.create(actor, input));
        if (input.action === 'status') return response(request, await service.status(actor, input));
        throw new UnitelError('invalid_request');
      } catch (error) { return failure(request, error); }
    },
    async webhook(request: Request) {
      const early = before(request, false); if (early) return early;
      try {
        if (!service || !deps.config) throw new UnitelError('integration_disabled');
        if (deps.config.webhookToken && !await equalSecret(request.headers.get('x-massa-unitel-token') ?? '', deps.config.webhookToken)) throw new UnitelError('unauthenticated');
        const event = await service.receiveEvent(await readJsonBody(request));
        // Duplicate deliveries are recovered by the leased worker; replaying one
        // notification must not bypass the inbox's query-rate limit.
        if (event.attempt_id && !event.duplicate && !event.processed_at && !event.rate_limited) deps.defer(service.processEvent(event));
        // Documented UNITEL ACK. This acknowledges delivery, never payment.
        return response(request, { status: 'success', message: 'Callback recebido com sucesso',
          OriginatorConversationID: event.merchant_ref, ConversationID: event.conversation_id, timestamp: new Date().toISOString() });
      } catch (error) { return failure(request, error); }
    },
    async reconcile(request: Request) {
      const early = before(request, false); if (early) return early;
      try {
        if (!service || !deps.config) throw new UnitelError('integration_disabled');
        if (!await equalSecret(request.headers.get('x-massa-reconcile-token') ?? '', deps.config.reconcileToken)) throw new UnitelError('unauthenticated');
        return response(request, await service.reconcileBatch(await readJsonBody(request, 8192)));
      } catch (error) { return failure(request, error); }
    },
  };
}
