import { useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MovieCard } from '@/components/MovieCard';
import { useMovies } from '@/hooks/useMovies';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, X, Heart } from 'lucide-react';
import { GENRES } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Browse() {
  const { movies, isLoading } = useMovies();
  const { user } = useAuth();
  const { favoriteMovies, isLoading: favoritesLoading } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const years = Array.from(new Set(movies.map(m => m.release_year).filter(Boolean))).sort((a, b) => (b || 0) - (a || 0));

  const filteredMovies = movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = !selectedGenre || movie.genre?.includes(selectedGenre);
    const matchesYear = !selectedYear || movie.release_year?.toString() === selectedYear;
    return matchesSearch && matchesGenre && matchesYear;
  });

  const filteredFavorites = favoriteMovies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = !selectedGenre || movie.genre?.includes(selectedGenre);
    const matchesYear = !selectedYear || movie.release_year?.toString() === selectedYear;
    return matchesSearch && matchesGenre && matchesYear;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre(null);
    setSelectedYear(null);
  };

  const hasFilters = searchQuery || selectedGenre || selectedYear;

  const MovieGrid = ({ movieList, loading }: { movieList: typeof movies; loading: boolean }) => (
    <>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] rounded-lg" />
              <Skeleton className="h-3 sm:h-4 w-3/4" />
              <Skeleton className="h-2 sm:h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : movieList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
          {movieList.map(movie => (
            <MovieCard key={movie.id} movie={movie} size="md" />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-20">
          <Filter className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Không tìm thấy phim</h3>
          <p className="text-muted-foreground text-sm sm:text-base">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="container mx-auto px-2 sm:px-4 space-y-4 sm:space-y-8">
          {/* Page Title */}
          <div className="space-y-1 sm:space-y-2 px-2 sm:px-0">
            <h1 className="font-display text-2xl sm:text-4xl md:text-5xl">Khám phá phim</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Tìm kiếm và khám phá bộ sưu tập phim đa dạng</p>
          </div>

          {/* Tabs for All Movies / Favorites */}
          {user && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
                <TabsTrigger value="all" className="gap-2">
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Tất cả phim</span>
                  <span className="sm:hidden">Tất cả</span>
                </TabsTrigger>
                <TabsTrigger value="favorites" className="gap-2">
                  <Heart className="w-4 h-4" />
                  <span className="hidden sm:inline">Phim yêu thích ({favoriteMovies.length})</span>
                  <span className="sm:hidden">Yêu thích ({favoriteMovies.length})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Search & Filters */}
          <div className="glass-card p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm phim..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary border-border text-sm sm:text-base"
                />
              </div>

              {/* Year Filter */}
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(e.target.value || null)}
                className="h-9 sm:h-10 px-3 rounded-lg bg-secondary border border-border text-foreground text-sm sm:text-base"
              >
                <option value="">Tất cả năm</option>
                {years.map(year => (
                  <option key={year} value={year?.toString()}>{year}</option>
                ))}
              </select>

              {hasFilters && (
                <Button variant="outline" onClick={clearFilters} className="gap-2 text-sm">
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Xóa bộ lọc</span>
                  <span className="sm:hidden">Xóa</span>
                </Button>
              )}
            </div>

            {/* Genre Tags - Horizontal scroll on mobile */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible scrollbar-hide">
              <Button
                variant={selectedGenre === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGenre(null)}
                className="rounded-full shrink-0 text-xs sm:text-sm"
              >
                Tất cả
              </Button>
              {GENRES.slice(0, 12).map(genre => (
                <Button
                  key={genre}
                  variant={selectedGenre === genre ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedGenre(genre)}
                  className="rounded-full shrink-0 text-xs sm:text-sm"
                >
                  {genre}
                </Button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            {user && activeTab === 'favorites' ? (
              <>
                <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base px-2 sm:px-0">
                  {filteredFavorites.length} phim yêu thích
                </p>
                <MovieGrid movieList={filteredFavorites} loading={favoritesLoading} />
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-3 sm:mb-4 text-sm sm:text-base px-2 sm:px-0">
                  {filteredMovies.length} phim được tìm thấy
                </p>
                <MovieGrid movieList={filteredMovies} loading={isLoading} />
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
