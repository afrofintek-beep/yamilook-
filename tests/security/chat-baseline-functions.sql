CREATE OR REPLACE FUNCTION public.add_group_member(_conversation_id uuid, _user_id uuid, _role group_member_role DEFAULT 'member'::group_member_role)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result json;
  _member_count int;
BEGIN
  -- Check if caller is admin
  IF NOT public.is_group_admin(auth.uid(), _conversation_id) THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can add members');
  END IF;

  -- Check member limit (256)
  SELECT COUNT(*) INTO _member_count
  FROM public.conversation_participants
  WHERE conversation_id = _conversation_id;

  IF _member_count >= 256 THEN
    RETURN json_build_object('success', false, 'error', 'Group member limit reached (256)');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'User is already a member');
  END IF;

  -- Add member
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (_conversation_id, _user_id, _role);

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _conversation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
      AND role = 'admin'
  )
$function$;

CREATE OR REPLACE FUNCTION public.remove_group_member(_conversation_id uuid, _user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_count int;
BEGIN
  -- Check if caller is admin
  IF NOT public.is_group_admin(auth.uid(), _conversation_id) THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can remove members');
  END IF;

  -- Prevent removing self if last admin
  IF _user_id = auth.uid() THEN
    SELECT COUNT(*) INTO _admin_count
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND role = 'admin';

    IF _admin_count <= 1 THEN
      RETURN json_build_object('success', false, 'error', 'Cannot leave group as last admin. Promote another admin first.');
    END IF;
  END IF;

  -- Remove member
  DELETE FROM public.conversation_participants
  WHERE conversation_id = _conversation_id AND user_id = _user_id;

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_member_role(_conversation_id uuid, _user_id uuid, _role group_member_role)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_count int;
BEGIN
  -- Check if caller is admin
  IF NOT public.is_group_admin(auth.uid(), _conversation_id) THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can change roles');
  END IF;

  -- Prevent demoting self if last admin
  IF _user_id = auth.uid() AND _role = 'member' THEN
    SELECT COUNT(*) INTO _admin_count
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND role = 'admin';

    IF _admin_count <= 1 THEN
      RETURN json_build_object('success', false, 'error', 'Cannot demote yourself as last admin');
    END IF;
  END IF;

  -- Update role
  UPDATE public.conversation_participants
  SET role = _role
  WHERE conversation_id = _conversation_id AND user_id = _user_id;

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_group_info(_conversation_id uuid, _name text DEFAULT NULL::text, _avatar_url text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_group_admin(auth.uid(), _conversation_id) THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can update group info');
  END IF;

  -- Update conversation
  UPDATE public.conversations
  SET 
    name = COALESCE(_name, name),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = _conversation_id AND type = 'group';

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_is_participant(conv_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conv_id 
    AND user_id = auth.uid()
  );
$function$;

