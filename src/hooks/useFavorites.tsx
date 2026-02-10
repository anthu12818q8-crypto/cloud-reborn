import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { Movie } from '@/types/database';
import { logger } from '@/lib/logger';

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteMovies, setFavoriteMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFavorites = async () => {
    if (!user) {
      setFavoriteIds([]);
      setFavoriteMovies([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data: favorites, error } = await supabase
        .from('favorites')
        .select('movie_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const ids = favorites?.map(f => f.movie_id) || [];
      setFavoriteIds(ids);

      if (ids.length > 0) {
        const { data: movies, error: moviesError } = await supabase
          .from('movies')
          .select('*')
          .in('id', ids);

        if (moviesError) throw moviesError;
        setFavoriteMovies(movies as Movie[] || []);
      } else {
        setFavoriteMovies([]);
      }
    } catch (error) {
      logger.error('Error fetching favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  const isFavorite = (movieId: string) => favoriteIds.includes(movieId);

  const toggleFavorite = async (movieId: string) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để thêm phim yêu thích');
      return false;
    }

    try {
      if (isFavorite(movieId)) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('movie_id', movieId);

        if (error) throw error;

        setFavoriteIds(prev => prev.filter(id => id !== movieId));
        setFavoriteMovies(prev => prev.filter(m => m.id !== movieId));
        toast.success('Đã xóa khỏi danh sách yêu thích');
        return false;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, movie_id: movieId });

        if (error) throw error;

        setFavoriteIds(prev => [...prev, movieId]);
        
        // Fetch the movie details to add to favoriteMovies
        const { data: movie } = await supabase
          .from('movies')
          .select('*')
          .eq('id', movieId)
          .single();

        if (movie) {
          setFavoriteMovies(prev => [...prev, movie as Movie]);
        }
        
        toast.success('Đã thêm vào danh sách yêu thích');
        return true;
      }
    } catch (error) {
      logger.error('Error toggling favorite:', error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
      return isFavorite(movieId);
    }
  };

  return {
    favoriteIds,
    favoriteMovies,
    isLoading,
    isFavorite,
    toggleFavorite,
    refetch: fetchFavorites,
  };
}
