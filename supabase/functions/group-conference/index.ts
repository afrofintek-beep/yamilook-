import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT } from "https://deno.land/x/jose@v4.14.4/index.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return reply({ error: "unauthenticated" }, 401);
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) return reply({ error: "unauthenticated" }, 401);
    const { conferenceId, deviceId, action } = await req.json();
    if (
      !uuid(conferenceId) ||
      !uuid(deviceId) ||
      !["join", "leave", "end", "heartbeat"].includes(action)
    )
      return reply({ error: "invalid_request" }, 400);
    const key = Deno.env.get("LIVEKIT_API_KEY"),
      secret = Deno.env.get("LIVEKIT_API_SECRET"),
      url = Deno.env.get("LIVEKIT_URL");
    if (!key || !secret || !url)
      return reply({ error: "video_unavailable" }, 503);
    const { data: access, error } = await db.rpc("group_conference_action", {
      p_action: action,
      p_id: conferenceId,
      p_payload: { device_id: deviceId },
    });
    if (error) return reply({ error: error.message }, 403);
    const room = `kosolola-group-${conferenceId}`,
      identity = `${user.id}:${deviceId}`;
    const sign = (
      video: Record<string, unknown>,
      name = "Participante",
      ttl = 60,
    ) =>
      new SignJWT({ video, name })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(key)
        .setSubject(identity)
        .setIssuedAt()
        .setNotBefore("0s")
        .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
        .sign(new TextEncoder().encode(secret));
    const endpoint = url
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/$/, "");
    const admin = async (
      method: string,
      body: unknown,
      grants: Record<string, unknown>,
    ) =>
      fetch(`${endpoint}/twirp/livekit.RoomService/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await sign(grants)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    if (action === "heartbeat") {
      const { data: stale, error: sweepError } = await db.rpc(
        "group_conference_action",
        { p_action: "sweep", p_id: conferenceId },
      );
      if (sweepError) return reply({ error: sweepError.message }, 403);
      const listed = await admin(
        "ListParticipants",
        { room },
        { room, roomAdmin: true },
      );
      if (!listed.ok && listed.status !== 404)
        return reply({ error: "service_unavailable" }, 503);
      const live = listed.ok ? (await listed.json()).participants || [] : [];
      const allowed = new Set<string>(stale?.allowed || []);
      const removals = await Promise.all(
        live
          .filter((p: { identity: string }) => !allowed.has(p.identity))
          .map((p: { identity: string }) =>
            admin(
              "RemoveParticipant",
              { room, identity: p.identity },
              { room, roomAdmin: true },
            ),
          ),
      );
      if (removals.some((r) => !r.ok && r.status !== 404))
        return reply({ error: "service_unavailable" }, 503);
      return reply({ ok: true });
    }
    if (action === "end" || action === "leave") {
      if (action === "leave" && !access?.ok) return reply({ ok: true });
      const closed = await admin(
        action === "end" ? "DeleteRoom" : "RemoveParticipant",
        action === "end" ? { room } : { room, identity },
        { room, roomAdmin: true },
      );
      if (!closed.ok && closed.status !== 404)
        return reply({ error: "room_close_failed" }, 502);
      return reply({ ok: true });
    }
    if (!access?.allowed) return reply({ error: "not_allowed" }, 403);
    // Enforce capacity in the media server as well as the transactional DB claim.
    try {
      const created = await admin(
        "CreateRoom",
        {
          name: room,
          max_participants: 8,
          empty_timeout: 90,
          departure_timeout: 30,
        },
        { roomCreate: true },
      );
      if (!created.ok) throw new Error("room_unavailable");
      const { data: profile } = await db
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const token = await sign(
        {
          room,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        profile?.display_name || "Participante",
      );
      return reply({
        token,
        url,
        callType: access.call_type,
        isHost: access.is_host,
      });
    } catch {
      await db.rpc("group_conference_action", {
        p_action: "leave",
        p_id: conferenceId,
        p_payload: { device_id: deviceId },
      });
      return reply({ error: "video_unavailable" }, 503);
    }
  } catch {
    return reply({ error: "service_unavailable" }, 503);
  }
});
