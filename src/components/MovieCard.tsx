import { Link } from 'react-router-dom';
import { Play, Star, Clock, Calendar, DollarSign } from 'lucide-react';
import { Movie } from '@/types/database';

interface MovieCardProps {
  movie: Movie;
  size?: 'sm' | 'md' | 'lg';
  index?: number;
}

const formatPrice = (amount: number) => {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1).replace('.0', '') + 'M';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(0) + 'K';
  }
  return amount.toString();
};

export function MovieCard({ movie, size = 'md', index = 0 }: MovieCardProps) {
  const sizeClasses = {
    sm: 'w-28 xs:w-32 sm:w-36 md:w-44',
    md: 'w-32 xs:w-36 sm:w-44 md:w-56',
    lg: 'w-36 xs:w-44 sm:w-52 md:w-72',
  };

  return (
    <Link 
      to={`/movie/${movie.id}`}
      className={`movie-card flex-shrink-0 ${sizeClasses[size]} group opacity-0 animate-fade-in`}
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
    >
      {/* Poster Container */}
      <div className="relative aspect-[2/3] bg-secondary rounded-xl overflow-hidden">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <span className="text-5xl font-display font-bold text-muted-foreground/50">
              {movie.title.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center transform scale-0 group-hover:scale-100 transition-all duration-300 delay-100 shadow-lg shadow-primary/50">
              <Play className="w-7 h-7 text-primary-foreground ml-1" fill="currentColor" />
            </div>
          </div>
          
          {/* Bottom Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {movie.release_year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {movie.release_year}
                </span>
              )}
              {movie.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {movie.duration}p
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating Badge */}
        {movie.imdb_rating && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/90 backdrop-blur-sm text-xs font-semibold shadow-lg">
            <Star className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
            {movie.imdb_rating}
          </div>
        )}

        {/* Featured Badge */}
        {movie.is_featured && !movie.requires_payment && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-lg">
            HOT
          </div>
        )}

        {/* Payment Badge - Top Left */}
        {movie.requires_payment && movie.payment_amount && movie.payment_amount > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/30">
            <DollarSign className="w-3 h-3" />
            {formatPrice(movie.payment_amount)}₫
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {movie.title}
        </h3>
        {movie.genre && movie.genre.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {movie.genre.slice(0, 2).map((g, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] bg-secondary rounded-md text-muted-foreground font-medium">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
