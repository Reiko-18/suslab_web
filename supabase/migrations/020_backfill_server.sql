-- 020: Backfill function to migrate existing data to multi-server schema

CREATE OR REPLACE FUNCTION public.backfill_server_data(target_server_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  counts JSONB := '{}';
  affected INT;
BEGIN
  UPDATE public.user_roles SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('user_roles', affected);

  UPDATE public.tickets SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('tickets', affected);

  UPDATE public.feedbacks SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('feedbacks', affected);

  UPDATE public.announcements SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('announcements', affected);

  UPDATE public.events SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('events', affected);

  UPDATE public.discord_roles SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('discord_roles', affected);

  UPDATE public.admin_audit_logs SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('admin_audit_logs', affected);

  UPDATE public.pending_bot_actions SET server_id = target_server_id WHERE server_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  counts := counts || jsonb_build_object('pending_bot_actions', affected);

  RETURN counts;
END;
$$;
