import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useMovies } from '@/hooks/useMovies';
import { GENRES } from '@/types/database';
import { Film, ChevronRight } from 'lucide-react';

export default function Genres() {
  const { movies, isLoading } = useMovies();

  const genresWithMovies = GENRES.map(genre => ({
    name: genre,
    movies: movies.filter(m => m.genre?.includes(genre)),
    count: movies.filter(m => m.genre?.includes(genre)).length,
  })).filter(g => g.count > 0);

  const gradients = [
    'from-red-500/20 to-orange-500/20',
    'from-blue-500/20 to-purple-500/20',
    'from-green-500/20 to-teal-500/20',
    'from-pink-500/20 to-rose-500/20',
    'from-yellow-500/20 to-amber-500/20',
    'from-indigo-500/20 to-blue-500/20',
    'from-purple-500/20 to-pink-500/20',
    'from-cyan-500/20 to-blue-500/20',
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 space-y-8">
          <div className="space-y-2">
            <h1 className="font-display text-4xl md:text-5xl">Thể loại phim</h1>
            <p className="text-muted-foreground">Khám phá phim theo thể loại yêu thích</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-secondary animate-pulse" />
              ))}
            </div>
          ) : genresWithMovies.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {genresWithMovies.map((genre, index) => (
                <Link
                  key={genre.name}
                  to={`/browse?genre=${encodeURIComponent(genre.name)}`}
                  className={`group relative h-40 rounded-xl overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} border border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02]`}
                >
                  {/* Background image from first movie */}
                  {genre.movies[0]?.poster_url && (
                    <img
                      src={genre.movies[0].poster_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity"
                    />
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                  
                  <div className="relative h-full p-4 flex flex-col justify-end">
                    <h3 className="font-display text-2xl group-hover:text-primary transition-colors">
                      {genre.name}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {genre.count} phim
                      <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Chưa có thể loại nào</h3>
              <p className="text-muted-foreground">Các thể loại sẽ xuất hiện khi có phim được thêm vào</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
