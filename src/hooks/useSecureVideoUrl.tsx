import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface UseSecureVideoUrlOptions {
  movieId: string | undefined;
  episodeNumber?: number | null;
  enabled?: boolean;
}

interface UseSecureVideoUrlResult {
  videoUrl: string | null;
  adVideoUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to securely fetch video URLs via RPC instead of exposing them in API responses.
 * This prevents video URLs from being visible in Network tab during initial data fetch.
 */
export function useSecureVideoUrl({
  movieId,
  episodeNumber = null,
  enabled = true,
}: UseSecureVideoUrlOptions): UseSecureVideoUrlResult {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [adVideoUrl, setAdVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideoUrls = async () => {
    if (!movieId || !enabled) {
      setVideoUrl(null);
      setAdVideoUrl(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch main video URL and ad URL in parallel for faster loading
      const mainPromise = supabase.rpc('get_playback_url', {
        p_movie_id: movieId,
        p_episode_number: episodeNumber,
      });

      const adPromise = !episodeNumber
        ? supabase.rpc('get_ad_playback_url', { p_movie_id: movieId })
        : Promise.resolve({ data: null, error: null });

      const [mainResult, adResult] = await Promise.all([mainPromise, adPromise]);

      if (mainResult.error) {
        if (mainResult.error.code === '28000') {
          setError('not_authenticated');
        } else if (mainResult.error.code === '42501') {
          setError('forbidden');
        } else if (mainResult.error.code === 'P0002') {
          setError('not_found');
        } else {
          logger.error('Error fetching playback URL:', mainResult.error);
          setError('unknown');
        }
        setVideoUrl(null);
      } else {
        setVideoUrl(mainResult.data);
      }

      setAdVideoUrl(adResult.data || null);
    } catch (err) {
      logger.error('Error in useSecureVideoUrl:', err);
      setError('unknown');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideoUrls();
  }, [movieId, episodeNumber, enabled]);

  return {
    videoUrl,
    adVideoUrl,
    isLoading,
    error,
    refetch: fetchVideoUrls,
  };
}
