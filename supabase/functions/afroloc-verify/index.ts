import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyCertification } from "./verification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Verify an existing declared address using an Auth-confirmed phone and partner evidence.
 * Requires AFROLOC_API_URL and YAMILOOK_PARTNER_KEY. This is not cross-app SSO.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: "POST, OPTIONS" } });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(supabaseUrl, serviceKey);
    const afrolocUrl = Deno.env.get("AFROLOC_API_URL");
    const partnerKey = Deno.env.get("YAMILOOK_PARTNER_KEY");
    const result = await verifyCertification(token, {
      getUser: async (jwt) => {
        const { data, error } = await userClient.auth.getUser(jwt);
        return error ? null : data.user;
      },
      getAddress: async (id) => {
        const { data, error } = await admin.from("profiles").select("afroloc_code").eq("id", id).single();
        if (error) throw new Error("profile_unavailable");
        return data.afroloc_code;
      },
      lookup: async (phone) => {
        if (!afrolocUrl || !partnerKey || new URL(afrolocUrl).protocol !== "https:") {
          throw new Error("integration_unavailable");
        }
        const response = await fetch(`${afrolocUrl.replace(/\/$/, '')}/partners/certification-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-partner-key": partnerKey },
          body: JSON.stringify({ phone }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        return { ok: response.ok, payload: await response.json().catch(() => null) };
      },
      save: async (id, code) => {
        const { data, error } = await admin.from("profiles").update({
          afroloc_certification_status: "certified",
          afroloc_certified_at: new Date().toISOString(),
          afroloc_certified_by: null,
        }).eq("id", id).eq("afroloc_code", code)
          .select("id, afroloc_code, afroloc_certification_status").single();
        return !error && data?.id === id && data.afroloc_code === code && data.afroloc_certification_status === "certified";
      },
    });
    return json(result, result.reason === "unauthorized" ? 401 : 200);
  } catch {
    console.error("AFROLOC verification failed");
    return json({ certified: false, reason: "verification_unavailable" }, 503);
  }
});
