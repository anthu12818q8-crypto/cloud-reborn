import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Info, ChevronLeft, ChevronRight, Star, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Movie } from '@/types/database';

interface HeroSliderProps {
  movies: Movie[];
}

export function HeroSlider({ movies }: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (movies.length <= 1) return;
    
    const interval = setInterval(() => {
      handleNext();
    }, 7000);

    return () => clearInterval(interval);
  }, [movies.length, currentIndex]);

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + movies.length) % movies.length);
    setTimeout(() => setIsTransitioning(false), 600);
  };

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % movies.length);
    setTimeout(() => setIsTransitioning(false), 600);
  };

  if (movies.length === 0) {
    return (
      <div className="relative h-[70vh] sm:h-[80vh] md:h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 gradient-radial-glow" />
        
        <div className="relative z-10 text-center space-y-4 sm:space-y-6 px-4 animate-fade-in">
          <h1 className="font-display text-3xl sm:text-5xl md:text-7xl font-bold">
            <span className="text-gradient">Chào mừng đến</span>
            <br />
            <span className="text-foreground">ANNDPhim</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-md mx-auto px-4">
            Khám phá bộ sưu tập phim đa dạng với chất lượng cao nhất
          </p>
          <Button asChild size="lg" className="btn-primary rounded-full px-6 sm:px-8 h-12 sm:h-14 text-base sm:text-lg gap-2">
            <Link to="/browse">
              <Play className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" />
              Khám phá ngay
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentMovie = movies[currentIndex];

  return (
    <div className="relative h-[70vh] sm:h-[80vh] md:h-[90vh] overflow-hidden -mt-16 sm:-mt-20">
      {/* Background Images with Transition */}
      {movies.map((movie, index) => (
        <div
          key={movie.id}
          className={`absolute inset-0 transition-all duration-700 ease-out ${
            index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          }`}
        >
          {movie.poster_url ? (
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-background to-background" />
          )}
        </div>
      ))}

      {/* Overlays */}
      <div className="absolute inset-0 hero-vignette" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      
      {/* Animated Glow */}
      <div className="absolute bottom-0 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-primary/20 rounded-full blur-[80px] sm:blur-[120px] animate-pulse-slow" />

      {/* Content */}
      <div className="relative h-full container mx-auto px-3 sm:px-4 flex items-end pb-16 sm:pb-24 md:pb-32">
        <div
          key={currentMovie.id}
          className="max-w-3xl space-y-4 sm:space-y-6 animate-slide-up"
        >
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {currentMovie.imdb_rating && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs sm:text-sm font-semibold">
                <Star className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" />
                {currentMovie.imdb_rating}/10
              </div>
            )}
            {currentMovie.release_year && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full glass-button text-xs sm:text-sm">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                {currentMovie.release_year}
              </div>
            )}
            {currentMovie.duration && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full glass-button text-xs sm:text-sm">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                {currentMovie.duration} phút
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
            {currentMovie.title}
          </h1>

          {/* Genres */}
          {currentMovie.genre && currentMovie.genre.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {currentMovie.genre.slice(0, 4).map((g, i) => (
                <span 
                  key={i} 
                  className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium border border-border/50 text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {currentMovie.description && (
            <p className="text-muted-foreground text-sm sm:text-lg line-clamp-2 sm:line-clamp-3 max-w-2xl leading-relaxed">
              {currentMovie.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 sm:gap-4 pt-2">
            <Button asChild size="lg" className="btn-primary rounded-full px-5 sm:px-8 h-11 sm:h-14 text-sm sm:text-lg gap-2 sm:gap-3 group">
              <Link to={`/movie/${currentMovie.id}`}>
                <Play className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" fill="currentColor" />
                Xem ngay
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="btn-outline-glow rounded-full px-5 sm:px-8 h-11 sm:h-14 text-sm sm:text-lg gap-2 sm:gap-3">
              <Link to={`/movie/${currentMovie.id}`}>
                <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                Chi tiết
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {movies.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full glass-button hover:scale-110 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="absolute right-2 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full glass-button hover:scale-110 transition-transform"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
        </>
      )}

      {/* Indicators */}
      {movies.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (!isTransitioning) {
                  setIsTransitioning(true);
                  setCurrentIndex(index);
                  setTimeout(() => setIsTransitioning(false), 600);
                }
              }}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index === currentIndex
                  ? 'w-10 bg-primary shadow-lg shadow-primary/50'
                  : 'w-1.5 bg-foreground/30 hover:bg-foreground/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
