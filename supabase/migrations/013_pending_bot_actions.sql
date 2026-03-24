-- supabase/migrations/013_pending_bot_actions.sql
-- Queue for Discord bot actions (executed when bot comes online)

CREATE TABLE IF NOT EXISTS public.pending_bot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.pending_bot_actions ENABLE ROW LEVEL SECURITY;

-- Moderator+ can read pending actions
CREATE POLICY "moderator_read_pending" ON public.pending_bot_actions
  FOR SELECT USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('moderator', 'admin')
  );

-- No INSERT policy — pending actions are inserted via service_role in edge functions.

-- Admin can update status (or service_role)
CREATE POLICY "admin_update_pending" ON public.pending_bot_actions
  FOR UPDATE USING (
    (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

CREATE INDEX idx_pending_status ON public.pending_bot_actions (status) WHERE status = 'pending';
