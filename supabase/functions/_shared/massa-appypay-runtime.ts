import { createClient } from 'npm:@supabase/supabase-js@2.90.1';
import { GatewayError, SandboxAppyPay, allowedOrigins, loadSandboxConfig } from './massa-appypay.ts';
import { createGatewayHandlers } from '../massa-appypay/handler.ts';
import type { GatewayStore, GatewayTransport } from './massa-appypay-service.ts';

const env = (key: string) => Deno.env.get(key);
const config = loadSandboxConfig(env);
const client = config && env('SUPABASE_SERVICE_ROLE_KEY') ? createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
const store: GatewayStore = {
  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!client) throw new GatewayError('storage_unavailable');
    const { data, error } = await client.rpc(name, args);
    if (error) {
      if (error.code === '42501') throw new GatewayError('access_denied');
      if (['P0001', '22023', '23505', '23514', '23503'].includes(error.code)) throw new GatewayError('request_rejected');
      throw new GatewayError('storage_unavailable');
    }
    return data as T;
  },
};
const disabled = async () => { throw new GatewayError('integration_disabled'); };
const gateway: GatewayTransport = config ? new SandboxAppyPay(config) : { create: disabled, get: disabled };

export const gatewayHandlers = createGatewayHandlers({
  config: client ? config : null, origins: allowedOrigins(env), store, gateway,
  async actor(request: Request) {
    const header = request.headers.get('Authorization') ?? '';
    if (!client || !header.startsWith('Bearer ')) return null;
    const { data, error } = await client.auth.getUser(header.slice(7));
    if (error || !data.user || data.user.is_anonymous) return null;
    return data.user.id;
  },
  defer(task: Promise<void>) {
    const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil(promise: Promise<void>): void } }).EdgeRuntime;
    if (runtime) runtime.waitUntil(task);
    else void task.catch(() => { /* The durable inbox/reconciliation lease survives shutdown. */ });
  },
});
