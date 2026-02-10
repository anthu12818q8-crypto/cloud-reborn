-- Add ad settings columns to movies table
ALTER TABLE public.movies 
ADD COLUMN IF NOT EXISTS ad_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ad_show_on_load boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.movies.ad_enabled IS 'Toggle to enable/disable ads for this movie';
COMMENT ON COLUMN public.movies.ad_show_on_load IS 'If true, show ad when page loads instead of at specific position';