-- Add ad and intro skip fields to movies table
ALTER TABLE public.movies 
ADD COLUMN IF NOT EXISTS ad_video_url text,
ADD COLUMN IF NOT EXISTS ad_position text DEFAULT 'start',
ADD COLUMN IF NOT EXISTS intro_start_seconds integer,
ADD COLUMN IF NOT EXISTS intro_end_seconds integer;

-- Add comment for documentation
COMMENT ON COLUMN public.movies.ad_video_url IS 'URL of advertisement video';
COMMENT ON COLUMN public.movies.ad_position IS 'Position of ad: start, middle, end, or custom time in seconds';
COMMENT ON COLUMN public.movies.intro_start_seconds IS 'Start time of intro segment in seconds';
COMMENT ON COLUMN public.movies.intro_end_seconds IS 'End time of intro segment in seconds';