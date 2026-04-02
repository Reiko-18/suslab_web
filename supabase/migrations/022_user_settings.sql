-- 022: Add per-user settings to member_profiles

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.member_profiles.settings IS
  'Per-user preferences. Shape: { language?: "en"|"ja"|"zh-CN"|"zh-TW" }';
