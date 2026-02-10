import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MovieCard } from './MovieCard';
import { Movie } from '@/types/database';
interface MovieRowProps {
  title: string;
  movies: Movie[];
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}
export function MovieRow({
  title,
  movies,
  size = 'md',
  icon
}: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const handleScroll = () => {
    if (scrollRef.current) {
      const {
        scrollLeft,
        scrollWidth,
        clientWidth
      } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -500 : 500;
      scrollRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  if (movies.length === 0) return null;
  return <section className="space-y-4 sm:space-y-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {icon || <Globe className="text-primary w-5 h-5 sm:w-[23px] sm:h-[23px] flex-shrink-0" />}
          <h2 className="font-display text-lg sm:text-2xl md:text-3xl font-bold truncate">{title}</h2>
        </div>
        <div className="hidden md:flex gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => scroll('left')} disabled={!showLeftArrow} className={`h-10 w-10 rounded-full glass-button transition-all ${showLeftArrow ? 'opacity-100' : 'opacity-30'}`}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => scroll('right')} disabled={!showRightArrow} className={`h-10 w-10 rounded-full glass-button transition-all ${showRightArrow ? 'opacity-100' : 'opacity-30'}`}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Movies Scroll */}
      <div className="relative group/row">
        {/* Left Gradient */}
        <div className={`absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity ${showLeftArrow ? 'opacity-100' : 'opacity-0'}`} />
        
        {/* Right Gradient */}
        <div className={`absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity ${showRightArrow ? 'opacity-100' : 'opacity-0'}`} />

        <div ref={scrollRef} onScroll={handleScroll} className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-hide px-3 sm:px-4 md:px-0 pb-4 -mx-1 px-1">
          {movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} size={size} index={index} />)}
        </div>
      </div>
    </section>;
}