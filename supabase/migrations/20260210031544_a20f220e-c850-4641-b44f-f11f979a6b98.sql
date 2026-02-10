
CREATE OR REPLACE FUNCTION public.has_paid_for_movie(
  p_user_id UUID,
  p_movie_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.payment_requests
    WHERE user_id = p_user_id AND movie_id = p_movie_id AND status = 'approved'
  );
END;
$$;
