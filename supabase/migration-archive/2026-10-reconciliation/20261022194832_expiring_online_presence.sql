-- Each visible browser renews its own lease; server timestamps prevent stale online flags.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.online_presence_leases (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 client_id uuid NOT NULL,
 seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, client_id)
);
ALTER TABLE private.online_presence_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.online_presence_leases FROM PUBLIC, anon, authenticated;
CREATE INDEX online_presence_expiry ON private.online_presence_leases(seen_at);

CREATE FUNCTION private.enforce_online_presence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 NEW.is_online := NEW.show_online_status IS DISTINCT FROM false AND EXISTS (
   SELECT 1 FROM private.online_presence_leases l
   WHERE l.user_id = NEW.id AND l.seen_at > now() - interval '2 minutes'
 );
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.enforce_online_presence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_online_presence BEFORE INSERT OR UPDATE OF is_online, show_online_status
ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.enforce_online_presence();

CREATE FUNCTION public.renew_online_presence(p_client_id uuid, p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_client_id IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Invalid presence'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
 IF p_active THEN
   INSERT INTO private.online_presence_leases(user_id,client_id,seen_at)
     VALUES(v_user,p_client_id,now())
     ON CONFLICT(user_id,client_id) DO UPDATE SET seen_at=now();
 ELSE
   DELETE FROM private.online_presence_leases WHERE user_id=v_user AND client_id=p_client_id;
 END IF;
 -- The trigger computes the flag from all active devices and the privacy preference.
 UPDATE public.profiles SET is_online=false, last_seen=now() WHERE id=v_user;
END $$;
REVOKE ALL ON FUNCTION public.renew_online_presence(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_online_presence(uuid,boolean) TO authenticated;

CREATE FUNCTION private.expire_online_presence()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 DELETE FROM private.online_presence_leases WHERE seen_at <= now()-interval '2 minutes';
 UPDATE public.profiles p SET is_online=false
 WHERE p.is_online AND (p.show_online_status = false OR NOT EXISTS (
   SELECT 1 FROM private.online_presence_leases l WHERE l.user_id=p.id AND l.seen_at>now()-interval '2 minutes'
 ));
END $$;
REVOKE ALL ON FUNCTION private.expire_online_presence() FROM PUBLIC, anon, authenticated;
-- Remove legacy flags immediately without inventing a new last-seen timestamp.
SELECT private.expire_online_presence();
SELECT cron.schedule('expire-yamilook-online-presence', '* * * * *', 'SELECT private.expire_online_presence()');
