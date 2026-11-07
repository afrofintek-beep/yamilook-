"""Run against a NEW, disposable local PostgreSQL database only.
PGHOST=127.0.0.1 PGDATABASE=invitation_campaign_test python -m unittest discover -s tests/invitation-campaigns -v
Real simultaneous clients; no PGlite single-connection concurrency simulation.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import psycopg
import unittest
import threading
import uuid

ROOT = Path(__file__).resolve().parents[2]
ADMIN, MEMBER, OTHER, OUTSIDER = [str(uuid.UUID(int=n)) for n in range(1, 5)]
if os.getenv('PGHOST') not in ('127.0.0.1', 'localhost') or not os.getenv('PGDATABASE', '').startswith('invitation_campaign_test'):
    raise RuntimeError('Use an explicitly named disposable local invitation_campaign_test database.')

def quote(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"

def sql(command, actor=None, role=None, ok=True):
    prefix = ''
    if role or actor:
        prefix = f'SET ROLE {role or "authenticated"}; SET request.jwt.claim.sub={quote(actor or "")};'
    try:
        output = []
        with psycopg.connect(autocommit=True, connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute(prefix + command)
                while True:
                    if cursor.description:
                        for row in cursor.fetchall():
                            output.append('|'.join(json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else ('t' if v is True else 'f' if v is False else '' if v is None else str(v)) for v in row))
                    if not cursor.nextset(): break
        if not ok: raise AssertionError('Unexpected success: ' + command)
        return '\n'.join(output).strip()
    except psycopg.Error as error:
        if ok: raise AssertionError(str(error)) from error
        return str(error)

def obj(command, actor=None, role=None):
    return json.loads(sql(command, actor, role))

def issue(c, actor=MEMBER, email=None, request=None, ok=True):
    query = f'select public.issue_campaign_invitation({quote(c)},{quote(request or uuid.uuid4())},{quote(email)})'
    return json.loads(sql(query, actor)) if ok else sql(query, actor, ok=False)

def signup(code, email='guest@example.com', user=None, extra=None, ok=True):
    meta = {'access_code': code, **(extra or {})}
    return sql(f'insert into auth.users(id,email,raw_user_meta_data) values({quote(user or uuid.uuid4())},{quote(email)},{quote(json.dumps(meta))}::jsonb)', ok=ok)

class Campaigns(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sql((ROOT / 'tests/invitation-campaigns/bootstrap.sql').read_text())
        for suffix in ('single_use_invitations','mvp_invitation_permissions','shareable_contact_invitations'):
            sql(next((ROOT / 'supabase/migrations').glob('*_' + suffix + '.sql')).read_text())
        gate = (ROOT / 'supabase/migrations/20260717160000_mvp_gate.sql').read_text()
        gate = gate[gate.index('CREATE OR REPLACE FUNCTION public.handle_new_user()'):]
        sql(gate + '\nCREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();')
        sql("""CREATE FUNCTION public.claim_mvp_campaign_invite(p_registration_id uuid,p_email text,p_name text,p_actor text,p_resend boolean DEFAULT false)
         RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
         declare i public.user_invitations; d public.user_invitations; owner_id uuid:='00000000-0000-0000-0000-000000000001'; v_email text:=lower(trim(p_email));
         begin
          select * into i from public.user_invitations where invited_by=owner_id and recipient_email=v_email and used_at is null order by created_at desc limit 1;
          d:=i;
          update public.user_invitations set expires_at=now()+interval '14 days' where code=d.code and used_at is null;
          return jsonb_build_object('code',i.code);
         end $$;
         revoke all on function public.claim_mvp_campaign_invite(uuid,text,text,text,boolean) from public,anon,authenticated;
         grant execute on function public.claim_mvp_campaign_invite(uuid,text,text,text,boolean) to service_role;
        """)
        sql(next((ROOT / 'supabase/migrations').glob('*_controlled_invitation_campaigns.sql')).read_text())

    def setUp(self):
        sql('truncate invitation_campaign_audit,invitation_campaign_members,user_invitations,invitation_campaigns,invitation_permissions,user_settings,user_roles,profiles,auth.users,mvp_candidates cascade;')
        for n, u in enumerate((ADMIN, MEMBER, OTHER, OUTSIDER), 1):
            sql(f"set session_replication_role=replica; insert into auth.users(id,email,created_at,last_sign_in_at,email_confirmed_at) values('{u}','u{n}@example.com',now()-interval '60 days',now(),now()); insert into profiles(id,email,display_name,referral_code) values('{u}','u{n}@example.com','User {n}','REFCODE{n}');")
        sql(f"insert into user_roles values('{ADMIN}','admin')")

    def campaign(self, **overrides):
        config = dict(name='Test campaign',status='draft',starts_at='2020-01-01T00:00:00Z',ends_at='2099-01-01T00:00:00Z',
                      max_per_user=3,max_total=10,active_within_days=30,min_account_days=7,require_confirmed_email=True,invite_ttl_hours=24)
        config.update(overrides)
        c = sql(f'select save_invitation_campaign(null,{quote(json.dumps(config))}::jsonb)', ADMIN)
        return c, config

    def activate(self, c, config, status='active'):
        config = {**config, 'status': status}
        sql(f'select save_invitation_campaign({quote(c)},{quote(json.dumps(config))}::jsonb)', ADMIN)
        return config

    def grant(self, c, user=MEMBER, allowed=True):
        email = f'u{int(uuid.UUID(user))}@example.com'
        sql(f'select set_campaign_member({quote(c)},{quote(email)},{str(allowed).lower()},\'presence-review/123\',now()+interval \'7 days\')', ADMIN)

    def ready(self, **overrides):
        c, cfg = self.campaign(**overrides); self.grant(c); self.activate(c, cfg)
        return c, cfg

    def test_01_permissions_and_no_automatic_entitlement(self):
        c, cfg = self.campaign()
        self.assertIn('permission denied', sql('select list_invitation_campaigns()', role='anon', ok=False))
        self.assertIn('administrador', sql(f'select save_invitation_campaign(null,{quote(json.dumps(cfg))}::jsonb)', MEMBER, ok=False))
        self.assertIn('administrador', sql(f"select set_campaign_member('{c}','u2@example.com',true,'reference',now()+interval '1 day')", MEMBER, ok=False))
        self.assertIn('permission denied', sql(f"insert into invitation_campaign_members values('{c}','{MEMBER}','{MEMBER}',now(),now(),'forged',null)", MEMBER, ok=False))
        self.assertIn('permission denied', sql(f"update invitation_campaigns set max_per_user=10", MEMBER, ok=False))
        self.assertEqual(obj('select list_invitation_campaigns()', MEMBER), [])
        self.activate(c,cfg)
        self.assertIn('elegibilidade',issue(c,ok=False))
        self.assertIn('Sem acesso',sql(f"select campaign_report('{c}',0)",OUTSIDER,ok=False))
        self.assertIn('administrador',sql("select issue_user_invitation('new@example.com')",MEMBER,ok=False))
        self.assertIn('administrador',sql(f"select issue_shareable_user_invitation('{uuid.uuid4()}')",MEMBER,ok=False))
        self.assertIn('permission denied',sql("select private.issue_user_invitation('new@example.com')",MEMBER,ok=False))

    def test_02_verified_presence_and_server_activity(self):
        c, cfg = self.ready()
        for expression in ("last_sign_in_at=now()-interval '40 days'", "banned_until=now()+interval '1 day'", "email_confirmed_at=null", "is_anonymous=true", "created_at=now()+interval '1 minute'", "deleted_at=now()"):
            sql(f'begin; update auth.users set {expression} where id={quote(MEMBER)}; commit')
            self.assertIn('elegibilidade',issue(c,ok=False))
            sql(f"update auth.users set last_sign_in_at=now(),banned_until=null,email_confirmed_at=now(),is_anonymous=false,created_at=now()-interval '60 days',deleted_at=null where id='{MEMBER}'")
        sql(f"update invitation_campaign_members set presence_valid_until=now()-interval '1 second' where campaign_id='{c}'")
        sql(f"update profiles set is_verified=true,last_seen=now() where id='{MEMBER}'")
        self.assertIn('elegibilidade',issue(c,ok=False), 'client profile badges do not prove presence')
        self.grant(c); self.assertIn('code',issue(c))

    def test_03_period_suspension_revocation_and_resume(self):
        c,cfg=self.campaign(starts_at='2098-01-01T00:00:00Z'); self.grant(c); self.activate(c,cfg)
        self.assertIn('período',issue(c,ok=False))
        cfg['starts_at']='2020-01-01T00:00:00Z'; self.activate(c,cfg)
        i=issue(c); self.activate(c,cfg,'suspended')
        self.assertIn('período',issue(c,ok=False))
        self.assertFalse(obj(f"select validate_mvp_access_code('{i['code']}')",role='anon')['valid'])
        self.assertIn('autorizado',signup(i['code'],ok=False))
        self.activate(c,cfg); self.grant(c,allowed=False)
        self.assertIn('elegibilidade',issue(c,ok=False))
        self.assertIn('autorizado',signup(i['code'],ok=False))
        self.grant(c); signup(i['code'])
        self.activate(c,cfg,'closed')
        self.assertIn('encerrada',sql(f"select save_invitation_campaign('{c}',{quote(json.dumps({**cfg,'status':'active'}))}::jsonb)",ADMIN,ok=False))

    def test_04_idempotency_duplicates_and_expiry_do_not_refund(self):
        c,cfg=self.ready(max_per_user=2); req=str(uuid.uuid4())
        i=issue(c,email=' New@Example.com ',request=req)
        self.assertEqual(i,issue(c,email='new@example.com',request=req))
        self.assertIn('Já existe',issue(c,email='new@example.com',ok=False))
        self.assertIn('outros dados',issue(c,email='other@example.com',request=req,ok=False))
        self.grant(c,OTHER)
        self.assertIn('indisponível',issue(c,OTHER,email='new@example.com',ok=False))
        self.assertIn('indisponível',issue(c,email='u3@example.com',ok=False))
        sql(f"update user_invitations set expires_at=now()-interval '1 second' where code='{i['code']}'")
        self.assertIn('expirou',issue(c,email='new@example.com',request=req,ok=False))
        self.assertIn('expirou',signup(i['code'],'new@example.com',ok=False))
        issue(c)
        self.assertIn('pessoal',issue(c,ok=False))
        report=obj(f"select campaign_report('{c}',0)",MEMBER)
        self.assertEqual((report['issued'],report['expired'],report['pending']),(2,1,1))
        self.assertNotIn('members',report)
        self.assertEqual(sql('select count(*) from user_invitations',OTHER),'0')
        self.assertIn('permission denied',sql('delete from user_invitations',MEMBER,ok=False))

    def test_05_single_use_email_binding_and_auth_rollback(self):
        c,_=self.ready(); i=issue(c,email='bound@example.com')
        self.assertIn('outro email',signup(i['code'],'wrong@example.com',ok=False))
        sql(f"begin; insert into auth.users(id,email,raw_user_meta_data) values('{uuid.uuid4()}','bound@example.com','{{\"access_code\":\"{i['code']}\"}}'); rollback;")
        self.assertTrue(obj(f"select validate_mvp_access_code('{i['code']}')",role='anon')['valid'])
        signup(i['code'],'bound@example.com')
        self.assertIn('já foi utilizado',signup(i['code'],'bound@example.com',ok=False))
        bearer=issue(c)
        def redeem(n):
            return sql(f"insert into auth.users(id,email,raw_user_meta_data) values('{uuid.uuid4()}','race{n}@example.com','{{\"access_code\":\"{bearer['code']}\"}}')",ok=True)
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            futures=[pool.submit(redeem,n) for n in range(8)]
            self.assertEqual(sum(f.exception() is None for f in futures),1)
        self.assertEqual(obj(f"select campaign_report('{c}',0)",MEMBER)['used'],2)

    def test_06_real_concurrent_personal_and_global_quotas(self):
        c,_=self.ready(max_per_user=3,max_total=5); self.grant(c,OTHER)
        with concurrent.futures.ThreadPoolExecutor(20) as pool:
            fs=[pool.submit(issue,c,MEMBER if n%2 else OTHER) for n in range(40)]
            self.assertEqual(sum(f.exception() is None for f in fs),5)
        counts=obj(f"select json_agg(n) from (select count(*) n from user_invitations where campaign_id='{c}' group by invited_by) x")
        self.assertEqual(sum(counts),5); self.assertLessEqual(max(counts),3)

    def test_07_real_concurrent_retries(self):
        c,_=self.ready(); request=str(uuid.uuid4())
        with concurrent.futures.ThreadPoolExecutor(16) as pool:
            result=list(pool.map(lambda _:issue(c,request=request),range(16)))
        self.assertEqual(len({i['code'] for i in result}),1)
        self.assertEqual(sql(f"select count(*) from user_invitations where campaign_id='{c}'"),'1')

    def test_08_legacy_individual_compatibility_and_reusable_bypass(self):
        sql(f"insert into invitation_permissions values('{MEMBER}','{ADMIN}',now())")
        for code,recipient in [('1111111111111111','legacy@example.com'),('2222222222222222',None)]:
            sql(f"insert into user_invitations(code,invited_by,recipient_email,request_id,expires_at) values('{code}','{MEMBER}',{quote(recipient)},'{uuid.uuid4()}',now()+interval '1 day')")
            signup(code,recipient or 'bearer@example.com')
            self.assertFalse(obj(f"select validate_mvp_access_code('{code}')",role='anon')['valid'])
        self.assertFalse(obj("select validate_mvp_access_code('REFCODE2')",role='anon')['valid'])
        self.assertIn('MVP_ONLY',signup('REFCODE2',ok=False))
        self.assertTrue(obj("select validate_mvp_access_code('REFCODE1')",role='anon')['valid'])
        self.assertIn('code',obj("select issue_user_invitation('admin-invite@example.com')",ADMIN))
        self.assertIn('campanha',sql("select set_invitation_permission('u3@example.com',true)",ADMIN,ok=False))

    def test_09_expiry_clipped_to_end_and_global_rate_limit(self):
        c,cfg=self.ready(max_per_user=10,max_total=20)
        cfg['ends_at']=sql("select (now()+interval '1 hour')::text"); self.activate(c,cfg)
        i=issue(c)
        self.assertEqual(sql(f"select expires_at=ends_at from user_invitations join invitation_campaigns on campaign_id=id where code='{i['code']}'"),'t')
        for _ in range(9): issue(c)
        d,_=self.ready(max_per_user=10,max_total=20)
        self.assertIn('por hora',issue(d,ok=False))
        self.assertIn('outros dados',issue(d,request=sql(f"select request_id from user_invitations where code='{i['code']}'"),ok=False))

    def test_10_validation_quota_edits_and_audit(self):
        c,cfg=self.ready(); issue(c); issue(c)
        cfg['max_per_user']=1
        self.assertIn('inferior',sql(f"select save_invitation_campaign('{c}',{quote(json.dumps({**cfg,'status':'active'}))}::jsonb)",ADMIN,ok=False))
        cfg['max_per_user']=11
        self.assertIn('check constraint',sql(f"select save_invitation_campaign('{c}',{quote(json.dumps({**cfg,'status':'active'}))}::jsonb)",ADMIN,ok=False))
        self.assertIn('Email inválido',issue(c,email='not-email',ok=False))
        self.assertIn('Pedido inválido',sql(f"select issue_campaign_invitation('{c}',null,null)",MEMBER,ok=False))
        self.assertIn('check constraint',sql(f"select set_campaign_member('{c}','u3@example.com',true,'',now()+interval '1 day')",ADMIN,ok=False))
        report=obj(f"select campaign_report('{c}',0)",ADMIN)
        self.assertEqual(report['issued'],2)
        self.assertTrue(any(a['action']=='member_approved' for a in report['audit']))
        self.assertIn('permission denied',sql('update invitation_campaign_audit set details=\'{}\'',MEMBER,ok=False))

    def test_11_suspension_waits_for_inflight_issue(self):
        c,cfg=self.ready()
        # Deterministic independent-connection ordering: lock held while a suspend request waits.
        command=f"begin; set role authenticated; set request.jwt.claim.sub='{MEMBER}'; select issue_campaign_invitation('{c}','{uuid.uuid4()}',null); select pg_sleep(0.5); commit;"
        with concurrent.futures.ThreadPoolExecutor(1) as pool:
            future=pool.submit(sql,command)
            # Wait for the transaction to hold its lock, not an assumed delay.
            for _ in range(500):
                if sql("select count(*) from pg_stat_activity where wait_event='PgSleep' and query like '%issue_campaign_invitation%'")!='0': break
            else: self.fail('Issuing transaction never acquired the lock')
            self.activate(c,cfg,'suspended')
            out=future.result(timeout=10)
        self.assertIn('período',issue(c,ok=False))
        code=json.loads(out.splitlines()[0])['code']
        self.assertFalse(obj(f"select validate_mvp_access_code('{code}')",role='anon')['valid'])

    def test_12_repeatable_read_never_issues_from_a_stale_quota_snapshot(self):
        c,_=self.ready(max_per_user=1,max_total=1)
        barrier=threading.Barrier(8)
        def repeatable_request():
            with psycopg.connect(autocommit=True) as conn:
                conn.execute('begin isolation level repeatable read')
                conn.execute('set role authenticated')
                conn.execute(f"set request.jwt.claim.sub='{MEMBER}'")
                conn.execute('select count(*) from public.user_invitations').fetchone()
                barrier.wait(timeout=10)
                try:
                    conn.execute('select issue_campaign_invitation(%s,%s,null)',(c,str(uuid.uuid4()))).fetchone()
                    conn.execute('commit')
                    return True
                except psycopg.Error:
                    conn.execute('rollback')
                    return False
        with concurrent.futures.ThreadPoolExecutor(8) as pool:
            self.assertEqual(sum(pool.map(lambda _: repeatable_request(),range(8))),1)
        self.assertEqual(sql(f"select count(*) from user_invitations where campaign_id='{c}'"),'1')

    def test_13_initial_admin_campaign_does_not_reuse_member_campaign_tokens(self):
        c,_=self.ready(); self.grant(c,ADMIN)
        token=issue(c,ADMIN,email='initial@example.com')
        old=obj("select issue_user_invitation('initial@example.com')",ADMIN)
        self.assertNotEqual(token['code'],old['code'])
        self.assertEqual(sql(f"select campaign_id is null from user_invitations where code='{old['code']}'"),'t')
        claim=f"select claim_mvp_campaign_invite('{uuid.uuid4()}','initial@example.com','Test','test',false)"
        self.assertIn('permission denied',sql(claim,MEMBER,ok=False))
        self.assertEqual(obj(claim)['code'],old['code'])
        self.assertEqual(sql(f"select expires_at={quote(token['expires_at'])}::timestamptz from user_invitations where code='{token['code']}'"),'t')

    def test_14_shortening_end_updates_pending_expiry_but_extension_never_revives(self):
        c,cfg=self.ready(); token=issue(c)
        cfg['ends_at']=sql("select (now()+interval '30 minutes')::text"); self.activate(c,cfg)
        shortened=sql(f"select expires_at::text from user_invitations where code='{token['code']}'")
        self.assertEqual(sql(f"select expires_at=ends_at from user_invitations join invitation_campaigns on campaign_id=id where code='{token['code']}'"),'t')
        cfg['ends_at']='2099-01-01T00:00:00Z'; self.activate(c,cfg)
        self.assertEqual(sql(f"select expires_at::text from user_invitations where code='{token['code']}'"),shortened)

if __name__ == '__main__': unittest.main()
