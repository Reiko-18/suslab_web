-- Add discord_flags column to member_profiles for caching Discord public_flags
ALTER TABLE public.member_profiles
ADD COLUMN IF NOT EXISTS discord_flags integer NOT NULL DEFAULT 0;
