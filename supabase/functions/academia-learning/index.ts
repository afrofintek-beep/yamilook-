import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleLearningRequest } from './handler.ts';
serve(req => handleLearningRequest(req, authorization => createClient(
  Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authorization } } },
)));
