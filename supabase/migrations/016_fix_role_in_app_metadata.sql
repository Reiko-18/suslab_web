-- 016: Fix role injection into auth.users raw_app_meta_data
-- The custom_access_token_hook works but implicit flow may not trigger it.
-- This ensures the role is always in raw_app_meta_data directly.

-- Update the new user trigger to also set raw_app_meta_data.role = 'member'
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'member');

  -- Also set role in raw_app_meta_data so JWT includes it
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- Backfill: sync all existing user_roles into auth.users raw_app_meta_data
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', r.role)
FROM public.user_roles r
WHERE u.id = r.user_id
AND (u.raw_app_meta_data ->> 'role') IS DISTINCT FROM r.role;
