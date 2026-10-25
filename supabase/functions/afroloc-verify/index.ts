import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { handleVerificationRequest } from "./handler.ts";

// Certification stays suspended until the official authority and its evidence
// lifecycle have been validated. No service-role client, partner call or write.
Deno.serve((req: Request) => handleVerificationRequest(req, async token => {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}));
