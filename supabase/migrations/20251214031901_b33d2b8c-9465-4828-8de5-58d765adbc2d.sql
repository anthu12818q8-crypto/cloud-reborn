-- Add display_order column for featured movies ordering
ALTER TABLE public.movies 
ADD COLUMN display_order integer DEFAULT 0;

-- Create index for faster ordering queries
CREATE INDEX idx_movies_display_order ON public.movies (display_order);

-- Update existing featured movies with default order based on created_at
UPDATE public.movies 
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_num 
  FROM public.movies 
  WHERE is_featured = true
) as subquery
WHERE public.movies.id = subquery.id;