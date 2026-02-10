-- Drop all policies that depend on is_vip function
DROP POLICY IF EXISTS "Chỉ VIP xem được phim" ON public.movies;
DROP POLICY IF EXISTS "Chỉ VIP xem được tập phim" ON public.episodes;
DROP POLICY IF EXISTS "VIP được tải video" ON storage.objects;

-- Now drop and recreate is_vip function
DROP FUNCTION IF EXISTS public.is_vip() CASCADE;

-- Create a simpler is_vip function that always returns true (no subscriptions table needed)
CREATE OR REPLACE FUNCTION public.is_vip()
RETURNS BOOLEAN AS $$
BEGIN
  -- Return true to allow access for all authenticated users
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create new RLS policies for movies - everyone can view
CREATE POLICY "Everyone can view movies" 
ON public.movies 
FOR SELECT 
USING (true);

-- Create new RLS policy for episodes - everyone can view
CREATE POLICY "Everyone can view episodes"
ON public.episodes
FOR SELECT
USING (true);