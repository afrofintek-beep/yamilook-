import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authorizedPaymentWebhook, settledPaymentStatus } from './validation.ts';

// AppyPay calls this endpoint when a charge settles. verify_jwt is disabled
// (see config.toml) — AppyPay has no Supabase JWT. We authenticate the call with
// a shared secret sent as the custom webhook parameter `x-yamilook-token`, and
// fulfilment is idempotent via fulfill_credit_purchase().

serve(async (req) => {
  const jr = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return jr({ error: "Method Not Allowed" }, 405);

  try {
    const raw = await req.text();

    // deno-lint-ignore no-explicit-any
    let payload: any = {};
    try { payload = JSON.parse(raw); } catch { /* non-JSON body */ }

    // --- authenticate the caller via the shared token (header / query / body) ---
    const expected = Deno.env.get("APPYPAY_WEBHOOK_TOKEN");
    if (!expected) {
      console.error('Payment webhook authentication is not configured');
      return jr({ error: 'webhook_unavailable' }, 503);
    }
    {
      const provided =
        req.headers.get("x-yamilook-token") ??
        new URL(req.url).searchParams.get("token") ??
        payload["x-yamilook-token"] ??
        payload.token ??
        "";
      if (!authorizedPaymentWebhook(expected, provided)) return jr({ error: "unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc);

    // Real AppyPay payload shape:
    //   { id, merchantTransactionId, amount, responseStatus: { successful, status, code, ... }, ... }
    // We put credit_purchases.id in merchantTransactionId, so read it back here.
    // merchantTransactionId is our short merchant_ref (<=15 alnum), not the
    // purchase UUID — map it back to the purchase.
    const merchantRef = (payload.merchantTransactionId ?? payload.merchant_transaction_id) as string | undefined;
    const providerRef = (payload.id ?? payload.chargeId ?? payload.transactionId ?? null) as string | null;

    if (!merchantRef) return jr({ error: "missing merchantTransactionId" }, 400);

    // Success lives inside responseStatus (successful:true / status:"Success" / code:100).
    // Credit ONLY on an actual payment (code 100 / status "Success"). REF sends
    // successful:true with code 101 (Pending) when the reference is generated —
    // that must NOT credit; the paid webhook (code 100) arrives when it's paid.
    const rs = (payload.responseStatus ?? {}) as Record<string, unknown>;
    const statusStr = String(rs.status ?? payload.status ?? "").toLowerCase();
    const paid = settledPaymentStatus(rs, payload.status);
    if (!paid) return jr({ ok: true, ignored: statusStr || String(rs.code ?? "unknown") });

    const { data: purchase } = await admin
      .from("credit_purchases").select("id").eq("merchant_ref", merchantRef).maybeSingle();
    if (!purchase) return jr({ error: "purchase not found for merchant_ref" }, 404);

    const { data, error } = await admin.rpc("fulfill_credit_purchase", {
      p_purchase_id: purchase.id,
      p_provider_ref: providerRef,
    });
    if (error) return jr({ error: error.message }, 500);
    return jr({ ok: true, result: data });
  } catch (e) {
    return jr({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
