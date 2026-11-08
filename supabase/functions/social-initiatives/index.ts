import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { actor, body, failure, json, preflight } from "../_shared/account-link.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  try {
    const input = await body(req);
    if (typeof input.action !== "string" || typeof input.slug !== "string") {
      return json({ error: "Pedido inválido." }, 400);
    }
    if (!["catalog", "profile"].includes(input.action)) await actor(req);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("social_initiative_action", {
      p_action: input.action, p_slug: input.slug, p_payload: input.payload ?? {},
    });
    if (error) {
      const message = error.code === "P0001" || error.code === "42501" ? error.message : "Não foi possível concluir o pedido.";
      return json({ error: message }, 400);
    }
    return json(data);
  } catch (error) {
    return failure(error);
  }
});
