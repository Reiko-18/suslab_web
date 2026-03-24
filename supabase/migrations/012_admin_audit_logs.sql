-- supabase/migrations/012_admin_audit_logs.sql
-- Audit log for all admin actions

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Moderator+ can read audit logs
CREATE POLICY "moderator_read_audit" ON public.admin_audit_logs
  FOR SELECT USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- No INSERT policy — audit rows are inserted exclusively via service_role
-- client in edge functions, which bypasses RLS.

CREATE INDEX idx_audit_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_audit_action ON public.admin_audit_logs (action);
CREATE INDEX idx_audit_target ON public.admin_audit_logs (target_type, target_id);
