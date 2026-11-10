"""Real PostgreSQL clients: shared links plus all existing invitation regressions."""
from test_campaigns import Campaigns, ROOT, ADMIN, MEMBER, sql, obj, quote, signup
import concurrent.futures
import threading
import unittest
import uuid


class SharedLinks(Campaigns):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        sql(next((ROOT / 'supabase/migrations').glob('*_shared_registration_links.sql')).read_text())

    def shared(self, limit=21, request=None):
        return obj(f"select create_registration_link('{request or uuid.uuid4()}','LinkedIn test',{limit},168)", ADMIN)

    def report(self):
        return obj('select admin_registration_links()', ADMIN)

    def test_shared_permissions_and_idempotency(self):
        request = uuid.uuid4()
        self.assertIn('permission denied', sql(f"select create_registration_link('{request}','Test',21,168)", role='anon',ok=False))
        self.assertIn('administrador', sql(f"select create_registration_link('{request}','Test',21,168)", MEMBER,ok=False))
        for limit, hours in ((0,168),(21,169),(21,0),(100001,24)):
            self.assertIn('inválida',sql(f"select create_registration_link('{request}','Test',{limit},{hours})",ADMIN,ok=False))
        link = self.shared(request=request)
        self.assertEqual(self.shared(request=request),link)
        self.assertIn('já utilizado',sql(f"select create_registration_link('{request}','Changed',21,168)",ADMIN,ok=False))
        self.assertIn('permission denied', sql('select * from private.registration_links', MEMBER, ok=False))
        self.assertIn('permission denied', sql(f"select private.consume_registration_link('{link['code']}','{uuid.uuid4()}','x@example.com')", MEMBER,ok=False))
        self.assertIn('administrador',sql('select admin_registration_links()', MEMBER,ok=False))
        self.assertIn('administrador',sql(f"select admin_registration_links('{link['id']}','suspended')",MEMBER,ok=False))
        valid = obj(f"select validate_mvp_access_code('{link['code']}')",role='anon')
        self.assertEqual(set(valid),{'valid','multi_use','remaining','expires_at'})
        self.assertEqual(valid['remaining'],21)

    def test_shared_concurrent_limit_21(self):
        link=self.shared()
        barrier=threading.Barrier(40)
        def attempt(n):
            barrier.wait()
            try:
                signup(link['code'],f'shared{n}@example.com')
                return True
            except AssertionError as e:
                self.assertIn('limite',str(e))
                return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=40) as pool:
            results=list(pool.map(attempt,range(40)))
        self.assertEqual(sum(results),21)
        self.assertEqual(sql('select count(*) from private.registration_link_redemptions'),'21')
        self.assertEqual(self.report()[0]['uses_count'],21)
        self.assertEqual(self.report()[0]['confirmed_count'],0)
        self.assertFalse(obj(f"select validate_mvp_access_code('{link['code']}')",role='anon')['valid'])

    def test_shared_suspend_expire_revoke_and_email(self):
        link=self.shared()
        obj(f"select admin_registration_links('{link['id']}','suspended')",ADMIN)
        self.assertIn('autorizado',signup(link['code'],ok=False))
        obj(f"select admin_registration_links('{link['id']}','active')",ADMIN)
        self.assertIn('Email obrigatório',signup(link['code'],email='',ok=False))
        signup(link['code'],email='ok@example.com')
        self.assertEqual(self.report()[0]['uses_count'],1)
        sql(f"update private.registration_links set created_at=now()-interval '2 days',expires_at=now()-interval '1 second' where id='{link['id']}'")
        self.assertIn('expirou',signup(link['code'],email='expired@example.com',ok=False))
        second=self.shared()
        sql('delete from user_roles')
        self.assertIn('autorizado',signup(second['code'],email='revoked@example.com',ok=False))

    def test_shared_failure_rolls_back_and_retains_audit(self):
        link=self.shared()
        sql("""create function public.test_reject_signup() returns trigger language plpgsql as $$
        begin if NEW.email='reject@example.com' then raise exception 'profile failure'; end if; return NEW; end $$;
        create trigger z_test_reject after insert on auth.users for each row execute function test_reject_signup();""")
        try:
            self.assertIn('profile failure',signup(link['code'],email='reject@example.com',ok=False))
            self.assertEqual(self.report()[0]['uses_count'],0)
            self.assertEqual(sql('select count(*) from private.registration_link_redemptions'),'0')
            user=uuid.uuid4()
            signup(link['code'],email='works@example.com',user=user)
            self.assertEqual(sql(f"select raw_user_meta_data->>'invitation_code' from auth.users where id='{user}'"),link['code'])
            self.assertEqual(sql(f"select referred_by from profiles where id='{user}'"),ADMIN)
            sql(f"update auth.users set email_confirmed_at=now() where id='{user}'")
            self.assertEqual(self.report()[0]['confirmed_count'],1)
            sql(f"delete from auth.users where id='{user}'")
            self.assertEqual(self.report()[0]['uses_count'],1,'deletion does not reopen a place')
        finally:
            sql('drop trigger z_test_reject on auth.users; drop function test_reject_signup()')

    def test_shared_repeatable_read_race(self):
        import psycopg
        link=self.shared(limit=1)
        barrier=threading.Barrier(8)
        def attempt(n):
            try:
                with psycopg.connect() as c:
                    c.execute('set transaction isolation level repeatable read')
                    c.execute('select count(*) from private.registration_links').fetchone()
                    barrier.wait()
                    c.execute('insert into auth.users(id,email,raw_user_meta_data) values(%s,%s,%s::jsonb)',
                        (uuid.uuid4(),f'snapshot{n}@example.com','{"access_code":"'+link['code']+'"}'))
                return True
            except psycopg.Error as e:
                self.assertIn(e.sqlstate,('40001','P0001'))
                return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(sum(pool.map(attempt,range(8))),1)
        self.assertEqual(self.report()[0]['uses_count'],1)


if __name__ == '__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SharedLinks))
    raise SystemExit(not result.wasSuccessful())
