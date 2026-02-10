import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Episode } from '@/types/database';

export function useEpisodes(movieId?: string) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchEpisodes = useCallback(async () => {
    if (!movieId) {
      setEpisodes([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('movie_id', movieId)
        .order('episode_number', { ascending: true });

      if (error) throw error;
      setEpisodes((data as Episode[]) || []);
    } catch (error) {
      logger.error('Error fetching episodes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [movieId]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  const addEpisode = async (episode: Omit<Episode, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('episodes')
        .insert(episode);

      if (error) throw error;
      toast({ title: 'Đã thêm tập phim' });
      fetchEpisodes();
    } catch (error: any) {
      logger.error('Error adding episode:', error);
      toast({ title: 'Lỗi thêm tập phim', description: error.message, variant: 'destructive' });
    }
  };

  const updateEpisode = async (id: string, updates: Partial<Episode>) => {
    try {
      const { error } = await supabase
        .from('episodes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Đã cập nhật tập phim' });
      fetchEpisodes();
    } catch (error: any) {
      logger.error('Error updating episode:', error);
      toast({ title: 'Lỗi cập nhật', description: error.message, variant: 'destructive' });
    }
  };

  const deleteEpisode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('episodes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Đã xóa tập phim' });
      fetchEpisodes();
    } catch (error: any) {
      logger.error('Error deleting episode:', error);
      toast({ title: 'Lỗi xóa tập phim', description: error.message, variant: 'destructive' });
    }
  };

  return {
    episodes,
    isLoading,
    addEpisode,
    updateEpisode,
    deleteEpisode,
    refetch: fetchEpisodes,
  };
}
