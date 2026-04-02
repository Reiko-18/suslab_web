-- 021: Update JWT hook to support per-server roles

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid
  ORDER BY
    CASE role
      WHEN 'admin' THEN 3
      WHEN 'moderator' THEN 2
      ELSE 1
    END DESC
  LIMIT 1;

  claims := event->'claims';

  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(coalesce(user_role, 'member'))
  );

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;
