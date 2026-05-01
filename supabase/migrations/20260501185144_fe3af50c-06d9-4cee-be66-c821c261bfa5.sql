DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Signed-in users submit own feedback" ON public.feedback;

CREATE POLICY "Signed-in users submit own feedback"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND length(message) > 0
  AND length(message) <= 5000
  AND email IS NOT NULL
  AND length(email) <= 320
  AND nickname IS NOT NULL
  AND length(nickname) <= 100
);