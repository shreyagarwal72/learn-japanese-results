
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS attempt_secret text;
DROP POLICY IF EXISTS "Anyone can view tests" ON public.tests;
