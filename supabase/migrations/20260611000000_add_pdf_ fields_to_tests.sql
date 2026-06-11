-- Add total_marks, question_paper_url, answer_key_url to the tests table

ALTER TABLE public.tests
  ADD COLUMN total_marks INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN question_paper_url TEXT,
  ADD COLUMN answer_key_url TEXT;
