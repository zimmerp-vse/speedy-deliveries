DROP POLICY "Anyone can submit feedback" ON public.feedback;

CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
TO authenticated, anon
WITH CHECK (
  length(message) > 0
  AND length(message) <= 5000
  AND (email IS NULL OR length(email) <= 320)
  AND (nickname IS NULL OR length(nickname) <= 100)
);