import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const ids = Array.from(
  { length: 12 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const [A, B, C, D] = ids,
  device = "10000000-0000-4000-8000-000000000001",
  otherDevice = "10000000-0000-4000-8000-000000000002";
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(id uuid primary key,display_name text);
create table public.conversations(id uuid primary key default gen_random_uuid(),type text,name text);
create table public.conversation_participants(conversation_id uuid,user_id uuid,primary key(conversation_id,user_id));
create table public.blocked_users(blocker_id uuid,blocked_id uuid);
create table public.calls(id uuid primary key default gen_random_uuid(),status text,caller_id uuid,callee_id uuid,initiator_id uuid);
create table public.call_participants(call_id uuid,user_id uuid,status text);
create function public.user_is_participant(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.conversation_participants where conversation_id=cid and user_id=auth.uid())$$;
`);
for (const [i, id] of ids.entries())
  await db.query("insert into public.profiles values($1,$2)", [
    id,
    `Synthetic ${i}`,
  ]);
const group = (
  await db.query(
    "insert into public.conversations(type,name) values('group','Synthetic group') returning id",
  )
).rows[0].id;
for (const id of ids.slice(0, 10))
  await db.query("insert into public.conversation_participants values($1,$2)", [
    group,
    id,
  ]);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261103002307_group_conferences.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function asUser(id, sql, params = []) {
  await db.exec("set role authenticated");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function action(actor, kind, id, payload = {}) {
  return (
    await asUser(actor, "select public.group_conference_action($1,$2,$3) r", [
      kind,
      id,
      JSON.stringify(payload),
    ])
  ).rows[0].r;
}
let c;
test("conference authorization and lifecycle", async (t) => {
  await t.test("anonymous cannot call the public endpoint", async () => {
    await db.exec("set role anon");
    try {
      await assert.rejects(
        db.query("select public.group_conference_action('list')"),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  await t.test("nonmember cannot start", async () => {
    await assert.rejects(
      action(ids[11], "create", group, { call_type: "voice", user_ids: [A] }),
      /not_allowed/,
    );
  });
  await t.test("empty and oversized participant selections fail", async () => {
    for (const peers of [[], ids.slice(1, 9)])
      await assert.rejects(
        action(A, "create", group, { call_type: "voice", user_ids: peers }),
        /choose_one_to_seven/,
      );
  });
  await t.test(
    "invalid member rolls back conference and all invitations",
    async () => {
      await assert.rejects(
        action(A, "create", group, { call_type: "voice", user_ids: [ids[11]] }),
        /participant_unavailable/,
      );
      assert.equal(
        (await db.query("select count(*) n from public.group_conferences"))
          .rows[0].n,
        0,
      );
    },
  );
  await t.test("creator and invitees are stored atomically", async () => {
    c = await action(A, "create", group, {
      call_type: "video",
      user_ids: [B, C],
    });
    assert.equal(
      (
        await db.query(
          "select count(*) n from public.group_conference_members where conference_id=$1",
          [c.id],
        )
      ).rows[0].n,
      3,
    );
  });
  await t.test("simultaneous second conference is rejected", async () => {
    await assert.rejects(
      action(B, "create", group, { call_type: "voice", user_ids: [C] }),
      /conference_exists/,
    );
  });
  await t.test("only invitees receive an invitation", async () => {
    assert.equal((await action(B, "list")).length, 1);
    assert.equal((await action(D, "list")).length, 0);
  });
  await t.test(
    "outsider cannot read conference or participant rows",
    async () => {
      for (const table of ["group_conferences", "group_conference_members"])
        assert.equal(
          (await asUser(ids[11], `select * from public.${table}`)).rows.length,
          0,
        );
    },
  );
  await t.test("clients cannot forge seats or invitations", async () => {
    await assert.rejects(
      asUser(
        D,
        "insert into public.group_conference_members(conference_id,user_id) values($1,$2)",
        [c.id, D],
      ),
      /permission denied/,
    );
    await assert.rejects(
      asUser(
        B,
        "update public.group_conference_members set status='joined' where conference_id=$1",
        [c.id],
      ),
      /permission denied/,
    );
  });
  await t.test(
    "membership without an invitation is insufficient to join",
    async () => {
      await assert.rejects(
        action(D, "join", c.id, { device_id: device }),
        /not_invited/,
      );
    },
  );
  await t.test(
    "declining while the creator is connecting preserves the other invitations",
    async () => {
      await action(B, "decline", c.id);
      assert.equal((await action(A, "detail", c.id)).status, "active");
    },
  );
  await t.test("creator joins and claims one device", async () => {
    assert.equal(
      (await action(A, "join", c.id, { device_id: device })).allowed,
      true,
    );
    await assert.rejects(
      action(A, "join", c.id, { device_id: otherDevice }),
      /another_device/,
    );
  });
  await t.test(
    "joined participant can renew the same device claim",
    async () => {
      assert.equal(
        (await action(A, "heartbeat", c.id, { device_id: device })).allowed,
        true,
      );
      await assert.rejects(
        action(A, "heartbeat", c.id, { device_id: otherDevice }),
        /session_lost/,
      );
    },
  );
  await t.test("declining does not terminate other participants", async () => {
    await action(B, "decline", c.id);
    assert.equal((await action(A, "detail", c.id)).status, "active");
    assert.equal((await action(B, "list")).length, 0);
  });
  await t.test(
    "only an active participant can invite more members",
    async () => {
      await assert.rejects(
        action(C, "invite", c.id, { user_ids: [D] }),
        /not_allowed/,
      );
      await action(A, "invite", c.id, { user_ids: [D] });
    },
  );
  await t.test("blocked invite is rejected", async () => {
    await db.query("insert into public.blocked_users values($1,$2)", [
      A,
      ids[4],
    ]);
    await assert.rejects(
      action(A, "invite", c.id, { user_ids: [ids[4]] }),
      /participant_unavailable/,
    );
    await db.exec("delete from public.blocked_users");
  });
  await t.test("recipient in direct call cannot join conference", async () => {
    const call = (
      await db.query(
        "insert into public.calls(status) values('ongoing') returning id",
      )
    ).rows[0].id;
    await db.query(
      "insert into public.call_participants values($1,$2,'connected')",
      [call, C],
    );
    await assert.rejects(
      action(C, "join", c.id, { device_id: device }),
      /caller_busy/,
    );
    await db.exec("delete from public.call_participants");
  });
  await t.test("participant leaves without disconnecting others", async () => {
    await action(C, "join", c.id, { device_id: device });
    await action(C, "leave", c.id, { device_id: device });
    assert.equal((await action(A, "detail", c.id)).status, "active");
    assert.equal(
      (await action(A, "heartbeat", c.id, { device_id: device })).allowed,
      true,
    );
  });
  await t.test("wrong device cannot release another seat", async () => {
    assert.equal(
      (await action(A, "leave", c.id, { device_id: otherDevice })).ok,
      false,
    );
    assert.equal(
      (await action(A, "heartbeat", c.id, { device_id: device })).allowed,
      true,
    );
  });
  await t.test(
    "remaining slots and eight-seat cap enforced server-side",
    async () => {
      await action(A, "invite", c.id, { user_ids: [B, C, ...ids.slice(4, 8)] });
      await assert.rejects(
        action(A, "invite", c.id, { user_ids: [ids[8]] }),
        /conference_full/,
      );
      for (const id of ids.slice(1, 8))
        await action(id, "join", c.id, { device_id: device });
      assert.equal(
        (
          await db.query(
            "select count(*) n from public.group_conference_members where conference_id=$1 and status='joined'",
            [c.id],
          )
        ).rows[0].n,
        8,
      );
    },
  );
  await t.test(
    "removed group member loses admission and heartbeat access",
    async () => {
      await db.query(
        "delete from public.conversation_participants where conversation_id=$1 and user_id=$2",
        [group, D],
      );
      await assert.rejects(
        action(D, "heartbeat", c.id, { device_id: device }),
        /not_allowed/,
      );
      await assert.rejects(
        action(D, "join", c.id, { device_id: device }),
        /not_allowed/,
      );
    },
  );
  await t.test(
    "a remaining member can revoke media for a removed group member",
    async () => {
      const stale = await action(A, "sweep", c.id);
      assert.ok(stale.removed.some((s) => s.identity === `${D}:${device}`));
    },
  );
  await t.test(
    "direct calls cannot start while caller or callee occupies a conference",
    async () => {
      await assert.rejects(
        db.query(
          "insert into public.calls(status,caller_id,callee_id) values('ringing',$1,$2)",
          [A, ids[11]],
        ),
        /caller_busy/,
      );
      await assert.rejects(
        db.query(
          "insert into public.calls(status,caller_id,callee_id) values('ringing',$1,$2)",
          [ids[11], A],
        ),
        /callee_busy/,
      );
    },
  );
  await t.test("only creator can end for everyone", async () => {
    await assert.rejects(action(B, "end", c.id), /organizer_required/);
    await action(A, "end", c.id);
    await action(A, "end", c.id);
    assert.equal((await action(B, "list")).length, 0);
    await assert.rejects(
      action(B, "join", c.id, { device_id: device }),
      /conference_closed/,
    );
  });
  await t.test("ended group can start a fresh conference", async () => {
    const next = await action(B, "create", group, {
      call_type: "voice",
      user_ids: [C],
    });
    assert.notEqual(next.id, c.id);
    assert.equal((await action(B, "current", group)).id, next.id);
    await action(B, "join", next.id, { device_id: device });
    await action(B, "leave", next.id, { device_id: device });
    assert.equal((await action(C, "list")).length, 0);
    assert.equal((await action(C, "detail", next.id)).status, "ended");
  });
  await t.test("account deletion cleans up conference references", async () => {
    await db.query("delete from public.profiles where id=$1",[B]);
    assert.equal((await db.query("select count(*) n from public.group_conference_members where user_id=$1",[B])).rows[0].n,0);
    assert.equal((await db.query("select count(*) n from public.group_conferences where created_by=$1",[B])).rows[0].n,0);
  });
});
