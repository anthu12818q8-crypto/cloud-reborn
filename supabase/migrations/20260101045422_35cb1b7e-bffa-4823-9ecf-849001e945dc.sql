-- Create watch history table to track video progress
CREATE TABLE public.watch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

-- Enable Row Level Security
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own watch history
CREATE POLICY "Users can view their own watch history"
ON public.watch_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own watch history
CREATE POLICY "Users can insert their own watch history"
ON public.watch_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own watch history
CREATE POLICY "Users can update their own watch history"
ON public.watch_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own watch history
CREATE POLICY "Users can delete their own watch history"
ON public.watch_history
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_watch_history_updated_at
BEFORE UPDATE ON public.watch_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();