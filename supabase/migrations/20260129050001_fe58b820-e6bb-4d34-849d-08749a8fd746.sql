-- Create episodes table for movies with multiple episodes
CREATE TABLE public.episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT,
  video_url TEXT NOT NULL,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(movie_id, episode_number)
);

-- Add has_episodes column to movies table
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS has_episodes BOOLEAN DEFAULT false;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS episode_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- RLS policies for episodes
CREATE POLICY "Episodes are viewable by everyone" 
ON public.episodes FOR SELECT USING (true);

CREATE POLICY "Admins can insert episodes" 
ON public.episodes FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update episodes" 
ON public.episodes FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete episodes" 
ON public.episodes FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_episodes_updated_at
BEFORE UPDATE ON public.episodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();