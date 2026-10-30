import { canJoinCall } from './call-access.ts';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenRequest {
  roomName: string;
  participantName: string;
  participantIdentity: string;
  isHost?: boolean;
}

interface VideoGrant {
  room?: string;
  roomJoin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  roomCreate?: boolean;
  roomList?: boolean;
  roomRecord?: boolean;
  roomAdmin?: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

interface ClaimGrants {
  identity?: string;
  name?: string;
  video?: VideoGrant;
  metadata?: string;
  sha256?: string;
}

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  grants: ClaimGrants,
  ttl: number = 6 * 60 * 60 // 6 hours in seconds
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    ...grants,
    iss: apiKey,
    sub: grants.identity,
    nbf: now,
    exp: now + ttl,
    iat: now,
    jti: grants.identity,
  };

  const secret = new TextEncoder().encode(apiSecret);
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(secret);

  return token;
}

// --- Rate Limiting ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication: verify the caller is a logged-in user ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authUser.id;
    // --- End authentication ---

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY');
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET');
    const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL');

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error('Missing LiveKit environment variables:', {
        hasApiKey: !!LIVEKIT_API_KEY,
        hasApiSecret: !!LIVEKIT_API_SECRET,
        hasUrl: !!LIVEKIT_URL,
      });
      return new Response(
        JSON.stringify({ error: 'LiveKit configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { roomName, participantName, participantIdentity, isHost = false }: TokenRequest = await req.json();

    if (!roomName || !participantName || !participantIdentity) {
      console.error('Missing required fields:', { roomName, participantName, participantIdentity });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: roomName, participantName, participantIdentity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize room name - lowercase, alphanumeric and dashes only
    const sanitizedRoomName = roomName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Use the authenticated user's ID as the participant identity for security
    const secureIdentity = userId;

    // --- Access control (authoritative, in the DB). MOKUBICO conversa rooms
    // (mok-*) gate on the chosen-guest list; live rooms gate on banda/approved. ---
    const isCall = /^call-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(roomName);
    if (roomName.startsWith('call-') && !isCall) {
      return new Response(JSON.stringify({ error: 'Invalid call room' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isMokubico = roomName.startsWith('mok-');
    let access: { allowed?: boolean; reason?: string; is_host?: boolean; media_enabled?: boolean } | null = null;
    let accessError: unknown = null;
    if (isCall) {
      // Use the caller's JWT and RLS, never a service-role client. Room IDs are
      // derived from existing calls; the frontend cannot choose other members.
      const callId = roomName.slice(5);
      const [callResult, memberResult] = await Promise.all([
        supabase.from('calls').select('id, status, initiator_id, caller_id, callee_id').eq('id', callId).maybeSingle(),
        supabase.from('call_participants').select('status').eq('call_id', callId).eq('user_id', userId).maybeSingle(),
      ]);
      accessError = callResult.error || memberResult.error;
      access = {
        allowed: canJoinCall(userId, callResult.data, memberResult.data),
        is_host: false, media_enabled: true,
      };
    } else {
      const result = await supabase.rpc(
      isMokubico ? 'can_join_mokubico_room' : 'can_join_live_room',
      { p_room: roomName },
    );
      access = result.data;
      accessError = result.error;
    }
    if (accessError) {
      console.error('can_join_live_room error:', accessError);
      return new Response(
        JSON.stringify({ error: 'Access check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!access?.allowed) {
      return new Response(
        JSON.stringify({ error: 'forbidden', reason: access?.reason ?? 'not_allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Publish rights come from the DB (host), not a client-supplied flag.
    const dbIsHost = access.is_host === true;
    // MOKUBICO conversas are group voice/video, but only when media is enabled
    // (Quintal needs Pro; a free Quintal is text-only → no publishing). Live
    // broadcasts stay host-only.
    const canPublish = isCall ? true : isMokubico ? access.media_enabled === true : dbIsHost;

    // Create grants based on role
    const grants: ClaimGrants = {
      identity: secureIdentity,
      name: participantName,
      video: {
        room: sanitizedRoomName,
        roomJoin: true,
        canPublish, // conversa: everyone talks; live: host only
        canSubscribe: true, // Everyone allowed in can subscribe/hear
        canPublishData: true, // Everyone allowed in can send chat messages
        roomCreate: dbIsHost, // Only the real host can create rooms
      },
    };

    const livekitToken = await createLiveKitToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, grants, isCall ? 600 : 6 * 60 * 60);

    console.log(`Generated token for ${participantName} (${isHost ? 'host' : 'viewer'}) in room ${sanitizedRoomName} [user: ${userId}]`);

    return new Response(
      JSON.stringify({ 
        token: livekitToken, 
        url: LIVEKIT_URL,
        roomName: sanitizedRoomName,
        isHost
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating LiveKit token:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate token';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
