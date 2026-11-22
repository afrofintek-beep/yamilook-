import { GatewayError, equalSecret, isUuid, readJsonBody } from '../_shared/massa-appypay.ts';
import type { SandboxConfig } from '../_shared/massa-appypay.ts';
import { MassaGatewayService } from '../_shared/massa-appypay-service.ts';
import type { GatewayStore, GatewayTransport } from '../_shared/massa-appypay-service.ts';

export interface HandlerDependencies {
  config: SandboxConfig | null; origins: Set<string>; store: GatewayStore; gateway: GatewayTransport;
  actor(request: Request): Promise<string | null>;
  defer(task: Promise<void>): void;
}

export function createGatewayHandlers(deps: HandlerDependencies) {
  const service = deps.config ? new MassaGatewayService(deps.config, deps.store, deps.gateway) : null;
  function response(request: Request, body: unknown, status = 200) {
    const origin = request.headers.get('Origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
    if (origin && deps.origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    return new Response(JSON.stringify(body), { status, headers });
  }
  function failure(request: Request, error: unknown) {
    const code = error instanceof GatewayError ? error.code : 'service_unavailable';
    const status = ['unauthenticated'].includes(code) ? 401 : ['access_denied'].includes(code) ? 403 :
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
          throw new GatewayError('integration_disabled');
        }
        const actor = await deps.actor(request);
        if (!actor || !isUuid(actor)) throw new GatewayError('unauthenticated');
        if (!deps.config.allowedUsers.has(actor)) {
          if (input.action === 'capabilities') return response(request, { enabled: false, environment: 'sandbox', methods: [] });
          throw new GatewayError('access_denied');
        }
        if (input.action === 'capabilities') return response(request, { enabled: true, environment: 'sandbox', methods: ['GPO', 'REF'] });
        if (input.action === 'create') return response(request, await service.create(actor, input));
        if (input.action === 'status') return response(request, await service.status(actor, input));
        throw new GatewayError('invalid_request');
      } catch (error) { return failure(request, error); }
    },
    async webhook(request: Request) {
      const early = before(request, false); if (early) return early;
      try {
        if (!service || !deps.config) throw new GatewayError('integration_disabled');
        if (deps.config.webhookMode === 'shared-token' && !await equalSecret(request.headers.get('x-yamilook-token') ?? '', deps.config.webhookToken)) {
          throw new GatewayError('unauthenticated');
        }
        const input = await readJsonBody(request);
        const event = await service.receiveEvent(input);
        // ACK only after durable storage; it is not a financial confirmation.
        if (event.attempt_id && !event.processed_at && !event.rate_limited) deps.defer(service.processEvent(event, input));
        return response(request, { received: true });
      } catch (error) { return failure(request, error); }
    },
    async reconcile(request: Request) {
      const early = before(request, false); if (early) return early;
      try {
        if (!service || !deps.config) throw new GatewayError('integration_disabled');
        if (!await equalSecret(request.headers.get('x-massa-reconcile-token') ?? '', deps.config.reconcileToken)) throw new GatewayError('unauthenticated');
        return response(request, await service.reconcileBatch(await readJsonBody(request, 8192)));
      } catch (error) { return failure(request, error); }
    },
  };
}
