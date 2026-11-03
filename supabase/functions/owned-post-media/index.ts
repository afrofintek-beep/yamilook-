import { handleOwnedPostMedia } from './handler.mjs';

Deno.serve((req: Request) => handleOwnedPostMedia(req, {
  url: Deno.env.get('SUPABASE_URL'),
  key: Deno.env.get('SUPABASE_ANON_KEY'),
}));
