import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const source = await readFile(
  new URL(
    "../../supabase/functions/group-conference/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const js = ts.transpileModule(source.replace(/^import .*;\n/gm, ""), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const id = "11111111-1111-4111-8111-111111111111",
  device = "22222222-2222-4222-8222-222222222222";
async function harness(options = {}) {
  let handler;
  const requests = [],
    grants = [],
    actions = [];
  const db = {
    auth: {
      getUser: async () => ({
        data: { user: options.anonymous ? null : { id: "synthetic" } },
        error: null,
      }),
    },
    rpc: async (name, args) => {
      actions.push(args);
      return options.rpc
        ? options.rpc(args)
        : {
            data: { allowed: true, is_host: true, call_type: "voice" },
            error: null,
          };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { display_name: "Synthetic participant" },
          }),
        }),
      }),
    }),
  };
  class JWT {
    constructor(payload) {
      grants.push(payload);
    }
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setSubject() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setNotBefore() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "synthetic-signature";
    }
  }
  const fetcher = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return options.remote ? options.remote(url, init) : new Response("{}");
  };
  new Function("serve", "createClient", "SignJWT", "Deno", "fetch", js)(
    (fn) => (handler = fn),
    () => db,
    JWT,
    {
      env: {
        get: (key) =>
          key === "LIVEKIT_URL"
            ? "wss://media.invalid"
            : options.noKeys && key === "LIVEKIT_API_KEY"
              ? null
              : "synthetic",
      },
    },
    fetcher,
  );
  const request = async (action = "join", body = {}) =>
    handler(
      new Request("https://example.invalid", {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conferenceId: id,
          deviceId: device,
          action,
          ...body,
        }),
      }),
    );
  return { handler, request, requests, grants, actions };
}
test("authentication is required before database or media calls", async () => {
  const h = await harness({ anonymous: true });
  assert.equal((await h.request()).status, 401);
  assert.equal(h.actions.length, 0);
  assert.equal(h.requests.length, 0);
});
test("invalid room identity fails before access or media", async () => {
  const h = await harness();
  assert.equal(
    (await h.request("join", { conferenceId: "forged-room" })).status,
    400,
  );
  assert.equal(h.actions.length, 0);
});
test("denied invitation produces no token or LiveKit request", async () => {
  const h = await harness({
    rpc: () => ({ error: { message: "not_invited" } }),
  });
  assert.equal((await h.request()).status, 403);
  assert.equal(h.requests.length, 0);
  assert.equal(h.grants.length, 0);
});
test("joins a server-derived room with eight seats and no admin token for client", async () => {
  const h = await harness();
  const r = await h.request();
  assert.equal(r.status, 200);
  assert.deepEqual(h.requests[0].body, {
    name: `kosolola-group-${id}`,
    max_participants: 8,
    empty_timeout: 90,
    departure_timeout: 30,
  });
  const grant = h.grants.at(-1).video;
  assert.equal(grant.room, `kosolola-group-${id}`);
  assert.equal(grant.roomJoin, true);
  assert.equal(grant.roomAdmin, undefined);
  assert.equal(grant.roomCreate, undefined);
});
test("room setup failure releases admission reservation", async () => {
  const h = await harness({
    remote: () => new Response("{}", { status: 503 }),
  });
  assert.equal((await h.request()).status, 503);
  assert.equal(h.actions.at(-1).p_action, "leave");
});
test("end for everyone deletes the authorized room", async () => {
  const h = await harness({ rpc: () => ({ data: { ok: true } }) });
  assert.equal((await h.request("end")).status, 200);
  assert.ok(h.requests[0].url.endsWith("/DeleteRoom"));
});
test("failed remote closure is reported rather than claimed successful", async () => {
  const h = await harness({
    rpc: () => ({ data: { ok: true } }),
    remote: () => new Response("{}", { status: 502 }),
  });
  assert.equal((await h.request("end")).status, 502);
});
test("a stale device cannot remove another live participant", async () => {
  const h = await harness({ rpc: () => ({ data: { ok: false } }) });
  assert.equal((await h.request("leave")).status, 200);
  assert.equal(h.requests.length, 0);
});
test("heartbeat reconciles the actual media roster so failed revocations retry", async () => {
  const h = await harness({
    rpc: (args) => ({
      data:
        args.p_action === "sweep"
          ? { allowed: ["allowed:device"], removed: [] }
          : { allowed: true },
    }),
    remote: (url) =>
      new Response(
        JSON.stringify(
          url.endsWith("/ListParticipants")
            ? {
                participants: [
                  { identity: "allowed:device" },
                  { identity: "removed:device" },
                ],
              }
            : {},
        ),
      ),
  });
  assert.equal((await h.request("heartbeat")).status, 200);
  assert.deepEqual(h.requests.at(-1).body, {
    room: `kosolola-group-${id}`,
    identity: "removed:device",
  });
});
