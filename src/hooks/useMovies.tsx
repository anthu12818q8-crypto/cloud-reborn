import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Movie } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMovies = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const moviesData = (data || []) as Movie[];
      setMovies(moviesData);
      // Sort featured movies by display_order (ascending - lower number first)
      setFeaturedMovies(
        moviesData
          .filter(m => m.is_featured)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      );
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách phim',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addMovie = async (movie: Omit<Movie, 'id' | 'created_at' | 'updated_at' | 'view_count'>) => {
    try {
      const { data, error } = await supabase
        .from('movies')
        .insert([movie])
        .select()
        .single();
      
      if (error) throw error;
      
      setMovies(prev => [data as Movie, ...prev]);
      toast({
        title: 'Thành công',
        description: 'Đã thêm phim mới',
      });
      
      return { data: data as Movie, error: null };
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
      return { data: null, error };
    }
  };

  const updateMovie = async (id: string, updates: Partial<Movie>) => {
    try {
      const { data, error } = await supabase
        .from('movies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      setMovies(prev => prev.map(m => m.id === id ? (data as Movie) : m));
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật phim',
      });
      
      return { data: data as Movie, error: null };
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
      return { data: null, error };
    }
  };

  const deleteMovie = async (id: string) => {
    try {
      const { error } = await supabase
        .from('movies')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setMovies(prev => prev.filter(m => m.id !== id));
      toast({
        title: 'Thành công',
        description: 'Đã xóa phim',
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const incrementViewCount = async (id: string) => {
    try {
      const movie = movies.find(m => m.id === id);
      if (movie) {
        await supabase
          .from('movies')
          .update({ view_count: (movie.view_count || 0) + 1 })
          .eq('id', id);
      }
    } catch (error) {
      logger.error('Error incrementing view count:', error);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  return {
    movies,
    featuredMovies,
    isLoading,
    fetchMovies,
    addMovie,
    updateMovie,
    deleteMovie,
    incrementViewCount,
  };
}

export function useMovie(id: string | undefined) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const fetchMovie = async () => {
      try {
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        setMovie(data as Movie);
      } catch (error: any) {
        toast({
          title: 'Lỗi',
          description: 'Không thể tải thông tin phim',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  return { movie, isLoading };
}
