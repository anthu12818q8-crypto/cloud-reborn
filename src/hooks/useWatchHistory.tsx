import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface WatchHistory {
  id: string;
  user_id: string;
  movie_id: string;
  progress_seconds: number;
  duration_seconds: number | null;
  last_watched_at: string;
}

export function useWatchHistory(movieId: string | undefined) {
  const { user } = useAuth();
  const [watchHistory, setWatchHistory] = useState<WatchHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch watch history for the movie
  useEffect(() => {
    if (!user || !movieId) {
      setWatchHistory(null);
      setIsLoading(false);
      return;
    }

    const fetchWatchHistory = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('watch_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('movie_id', movieId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching watch history:', error);
      } else {
        setWatchHistory(data);
      }
      setIsLoading(false);
    };

    fetchWatchHistory();
  }, [user, movieId]);

  // Save or update progress
  const saveProgress = useCallback(async (progressSeconds: number, durationSeconds: number) => {
    if (!user || !movieId) return;

    // Don't save if progress is too small (less than 5 seconds)
    if (progressSeconds < 5) return;

    // Don't save if we're at the very end (within 10 seconds of the end)
    if (durationSeconds - progressSeconds < 10) {
      // Delete watch history when movie is finished
      await supabase
        .from('watch_history')
        .delete()
        .eq('user_id', user.id)
        .eq('movie_id', movieId);
      return;
    }

    const { error } = await supabase
      .from('watch_history')
      .upsert({
        user_id: user.id,
        movie_id: movieId,
        progress_seconds: Math.floor(progressSeconds),
        duration_seconds: Math.floor(durationSeconds),
        last_watched_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,movie_id'
      });

    if (error) {
      console.error('Error saving watch progress:', error);
    }
  }, [user, movieId]);

  // Clear watch history (start from beginning)
  const clearProgress = useCallback(async () => {
    if (!user || !movieId) return;

    await supabase
      .from('watch_history')
      .delete()
      .eq('user_id', user.id)
      .eq('movie_id', movieId);

    setWatchHistory(null);
  }, [user, movieId]);

  return {
    watchHistory,
    isLoading,
    saveProgress,
    clearProgress,
    hasProgress: watchHistory && watchHistory.progress_seconds > 0,
    progressSeconds: watchHistory?.progress_seconds || 0,
  };
}
