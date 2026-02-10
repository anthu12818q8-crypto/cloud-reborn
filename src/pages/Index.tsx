import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HeroSlider } from '@/components/HeroSlider';
import { MovieRow } from '@/components/MovieRow';
import { useMovies } from '@/hooks/useMovies';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Clock, TrendingUp, Star } from 'lucide-react';

const Index = () => {
  const { movies, featuredMovies, isLoading } = useMovies();

  const latestMovies = movies.slice(0, 12);
  const topRatedMovies = [...movies].sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0)).slice(0, 12);
  const mostViewedMovies = [...movies].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 12);

  return (
    <div className="min-h-screen bg-background">
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      <Header />
      
      <main>
        {/* Hero Section */}
        {isLoading ? (
          <div className="h-[90vh] bg-gradient-to-b from-secondary to-background animate-pulse" />
        ) : (
          <HeroSlider movies={featuredMovies.length > 0 ? featuredMovies : movies.slice(0, 5)} />
        )}

        {/* Movie Rows */}
        <div className="container mx-auto py-12 space-y-16 relative z-10">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
          
          {isLoading ? (
            <div className="space-y-12">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-6">
                  <Skeleton className="h-10 w-64" />
                  <div className="flex gap-5">
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <div key={j} className="flex-shrink-0 w-56 space-y-3">
                        <Skeleton className="aspect-[2/3] rounded-xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <MovieRow 
                title="Phim mới cập nhật" 
                movies={latestMovies} 
                icon={<Clock className="w-6 h-6 text-primary" />}
              />
              <MovieRow 
                title="Đánh giá cao nhất" 
                movies={topRatedMovies}
                icon={<Star className="w-6 h-6 text-yellow-500" />}
              />
              <MovieRow 
                title="Xem nhiều nhất" 
                movies={mostViewedMovies}
                icon={<TrendingUp className="w-6 h-6 text-green-500" />}
              />
              {featuredMovies.length > 0 && (
                <MovieRow 
                  title="Phim nổi bật" 
                  movies={featuredMovies}
                  size="lg"
                  icon={<Flame className="w-6 h-6 text-orange-500" />}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
