-- Emergency rollback only after verifying a quota regression.
-- This restores the prior RLS setting, not a preferred steady state.
ALTER TABLE public.academy_public_ai_quota DISABLE ROW LEVEL SECURITY;
