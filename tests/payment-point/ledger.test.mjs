import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon; create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table public.profiles(id uuid primary key, display_name text);
 create function public.has_role(uuid,text) returns boolean language sql as $$select $1='${id(9)}'::uuid$$;
 grant usage on schema auth to authenticated;`);
await db.exec(readFileSync('supabase/migrations/20261118163926_payment_point_sandbox.sql','utf8'));
for (const n of [1,2,3,9]) await db.query('insert into auth.users values($1);',[id(n)]);
async function act(user,action,reference=null,amount=null,text=null) {
 await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(user)}'`);
 try { return (await db.query('select payment_point_action($1,$2,$3,$4) result',[action,reference,amount,text])).rows[0].result; }
 finally { await db.exec('reset role'); }
}
await test('topup retries are idempotent and purchased funds cannot be withdrawn', async()=>{
 await act(1,'topup',id(100),1000000); await act(1,'topup',id(100),1000000);
 assert.equal((await act(1,'overview')).wallet.purchased,1000000);
 await assert.rejects(act(1,'topup',id(100),1),/incompatível/);
 await assert.rejects(act(2,'topup',id(100),1000000),/incompatível/);
 await assert.rejects(act(1,'withdraw',id(200),100,'Test account'),/elegível/);
});
await test('order payment is atomic, single-use and cannot pay self',async()=>{
 await act(2,'merchant'); await act(2,'create',id(101),350000,'Product');
 await assert.rejects(act(2,'pay',id(101)),/indisponível/);
 await act(1,'pay',id(101)); await act(1,'pay',id(101));
 assert.equal((await act(1,'overview')).wallet.purchased,650000);
 assert.equal((await act(2,'overview')).wallet.earned,350000);
 await assert.rejects(act(3,'pay',id(101)),/indisponível/);
 await act(2,'create',id(102),900000,'Too expensive');
 await assert.rejects(act(1,'pay',id(102)),/insuficiente/);
 assert.equal((await act(2,'view',id(102))).status,'pending');
});
await test('refund restores original fund classification and is idempotent',async()=>{
 await assert.rejects(act(1,'refund',id(101)),/permissão/);
 await act(2,'refund',id(101)); await act(2,'refund',id(101));
 assert.equal((await act(1,'overview')).wallet.purchased,1000000);
 assert.equal((await act(1,'overview')).wallet.earned,0);
 assert.equal((await act(2,'overview')).wallet.earned,0);
});
await test('withdrawals reserve funds, restrict admins, reject or settle exactly once',async()=>{
 await act(2,'create',id(103),350000,'Product'); await act(1,'pay',id(103));
 await act(2,'withdraw',id(201),200000,'Test account'); await act(2,'withdraw',id(201),200000,'Test account');
 assert.equal((await act(2,'overview')).wallet.earned,150000);
 await assert.rejects(act(2,'refund',id(103)),/insuficiente/);
 await assert.rejects(act(2,'completed',id(201),null,'fake'),/permissão/);
 await assert.rejects(act(9,'completed',id(201),null,'receipt'),/confirmação/);
 await act(9,'rejected',id(201),null,'Test rejection');
 assert.equal((await act(2,'overview')).wallet.earned,350000);
 await act(2,'withdraw',id(202),100000,'Test account');
 await act(9,'processing',id(202));
 await assert.rejects(act(2,'cancel_withdrawal',id(202)),/indisponível/);
 await act(9,'completed',id(202),null,'Test receipt'); await act(9,'completed',id(202),null,'Test receipt');
 assert.equal((await act(2,'overview')).wallet.reserved,0);
 assert.equal((await act(2,'overview')).wallet.earned,250000);
});
await test('RLS and journal balancing protect entries',async()=>{
 await act(3,'overview');
 await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(3)}'`);
 assert.equal((await db.query('select * from payment_point_wallets')).rows.length,1);
 await assert.rejects(db.query("update payment_point_wallets set purchased=999"),/permission denied/);
 await assert.rejects(db.query("select * from payment_point_private.journals"),/permission denied/);
 await db.exec('reset role');
 assert.equal((await db.query('select journal_id from payment_point_entries group by journal_id having sum(amount)<>0')).rows.length,0);
 await assert.rejects(db.query('update payment_point_entries set amount=1'),/Immutable/);
});
await db.close();
