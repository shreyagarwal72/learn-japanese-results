CREATE TABLE public.results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  total_marks INTEGER NOT NULL,
  marks_obtained INTEGER NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  grade TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.results TO anon, authenticated;
GRANT ALL ON public.results TO service_role;

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert results" ON public.results FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can view results" ON public.results FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX results_submitted_at_idx ON public.results (submitted_at DESC);