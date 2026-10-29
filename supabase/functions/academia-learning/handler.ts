const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
interface DatabaseClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code: string; message: string } | null }>;
}
export async function handleLearningRequest(req: Request, createDatabase: (authorization: string) => DatabaseClient) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Método inválido.' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Inicia sessão novamente.' }, 401);
    const db = createDatabase(authorization);
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return respond({ error: 'Inicia sessão novamente.' }, 401);
    const body = await req.text();
    if (new TextEncoder().encode(body).byteLength > 16000) return respond({ error: 'O pedido é demasiado longo.' }, 413);
    let input;
    try { input = JSON.parse(body); } catch { return respond({ error: 'Pedido inválido.' }, 400); }
    if (!input || Array.isArray(input) || !['create', 'plan', 'challenge', 'submit', 'review', 'complete', 'cancel'].includes(input.action) ||
      (input.action !== 'create' && (typeof input.goalId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.goalId))) ||
      (input.payload !== undefined && (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)))) return respond({ error: 'Pedido inválido.' }, 400);
    const { data, error } = await db.rpc('academia_learning_action', { p_action: input.action, p_goal: input.action === 'create' ? null : input.goalId, p_payload: input.payload || {} });
    if (error) {
      const message = ['P0001', '42501'].includes(error.code) ? error.message : 'Verifica os campos e tenta novamente.';
      return respond({ error: message }, error.code === '42501' ? 403 : 400);
    }
    return respond({ id: data });
  } catch {
    console.error('Academia learning request failed');
    return respond({ error: 'Não foi possível guardar. Tenta novamente.' }, 500);
  }
}
