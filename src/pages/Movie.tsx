import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useLayoutEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useMovie, useMovies } from '@/hooks/useMovies';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useEpisodes } from '@/hooks/useEpisodes';
import { useSecureVideoUrl } from '@/hooks/useSecureVideoUrl';
import { useTier } from '@/hooks/useTier';
import { MovieRow } from '@/components/MovieRow';
import { EpisodeSelector } from '@/components/EpisodeSelector';
import { MovieComments } from '@/components/MovieComments';
import { Star, Calendar, Clock, Users, Heart, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PaymentRequiredDialog } from '@/components/PaymentRequiredDialog';
import { LoginRequiredDialog } from '@/components/LoginRequiredDialog';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export default function Movie() {
  const { id } = useParams();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  const { movie, isLoading } = useMovie(id);
  const { movies, incrementViewCount } = useMovies();
  const { user } = useAuth();
  const { userInfo, fetchUserBalance } = useTier();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { progressSeconds, saveProgress, clearProgress } = useWatchHistory(id);
  const { episodes } = useEpisodes(id);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [existingPayment, setExistingPayment] = useState<{ status: string } | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [currentEpisode, setCurrentEpisode] = useState(1);

  // Calculate derived state for video access
  const hasEpisodes = movie?.has_episodes && episodes.length > 0;
  const canWatch = !movie?.requires_payment || hasPaid;
  const needsLogin = !user;
  
  // Use secure video URL hook - must be called before any conditional returns
  const { 
    videoUrl: secureVideoUrl, 
    adVideoUrl: secureAdVideoUrl,
    isLoading: isVideoUrlLoading 
  } = useSecureVideoUrl({
    movieId: id,
    episodeNumber: hasEpisodes ? currentEpisode : null,
    enabled: !!user && canWatch && !needsLogin,
  });

  const isMovieFavorite = id ? isFavorite(id) : false;
  const relatedMovies = movies.filter(m => m.id !== id && m.genre?.some(g => movie?.genre?.includes(g))).slice(0, 10);

  // Check payment status when movie loads
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!id || !user?.id || !movie?.requires_payment) {
        setCheckingPayment(false);
        setHasPaid(false);
        return;
      }

      try {
        const { data: paidData } = await supabase.rpc('has_paid_for_movie', {
          p_user_id: user.id,
          p_movie_id: id,
        });

        if (paidData) {
          setHasPaid(true);
          setCheckingPayment(false);
          return;
        }

        const { data: paymentReq } = await supabase
          .from('payment_requests')
          .select('status')
          .eq('user_id', user.id)
          .eq('movie_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paymentReq) {
          setExistingPayment(paymentReq);
          if (paymentReq.status === 'approved') {
            setHasPaid(true);
          }
        }
      } catch (error) {
        logger.error('Error checking payment status:', error);
      } finally {
        setCheckingPayment(false);
      }
    };

    checkPaymentStatus();
  }, [id, user?.id, movie?.requires_payment]);

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavorite(id);
    }
  };

  const handleWatchMovie = () => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    if (movie?.requires_payment && !hasPaid) {
      setShowPaymentDialog(true);
      return;
    }
  };

  const handlePaymentSubmitted = () => {
    setShowPaymentDialog(false);
    setExistingPayment({ status: 'pending' });
  };

  const handleSelectEpisode = (episodeNumber: number) => {
    setCurrentEpisode(episodeNumber);
  };

  // Derived state for payment requirement
  const needsPayment = user && movie?.requires_payment && !hasPaid;
  const currentVideoUrl = secureVideoUrl;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16 sm:pt-20 container mx-auto px-2 sm:px-4">
          <Skeleton className="w-full aspect-video rounded-lg" />
          <Skeleton className="h-8 sm:h-10 w-3/4 sm:w-1/2 mt-4 sm:mt-6" />
          <Skeleton className="h-16 sm:h-20 w-full mt-3 sm:mt-4" />
        </main>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16 sm:pt-20 container mx-auto px-2 sm:px-4 text-center py-16 sm:py-20">
          <h1 className="text-xl sm:text-2xl font-display">Không tìm thấy phim</h1>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header className={`transition-all duration-300 ${isVideoPlaying ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'}`} />
      <main className={`transition-all duration-300 ${isVideoPlaying ? 'pt-0' : 'pt-16 sm:pt-20'}`}>
        <div className="container mx-auto px-2 sm:px-4 space-y-4 sm:space-y-8">
          {/* Video Player */}
          <div className="w-full -mx-2 sm:mx-0">
            {canWatch && !needsLogin && currentVideoUrl ? (
              <VideoPlayer 
                src={currentVideoUrl} 
                poster={movie.poster_url || undefined} 
                title={hasEpisodes ? `${movie.title} - Tập ${currentEpisode}` : movie.title} 
                onPlay={() => incrementViewCount(movie.id)}
                onPlayingChange={setIsVideoPlaying}
                savedProgress={progressSeconds}
                onSaveProgress={saveProgress}
                onClearProgress={clearProgress}
                adVideoUrl={movie.ad_enabled ? secureAdVideoUrl : null}
                adPosition={movie.ad_position}
                adShowOnLoad={movie.ad_show_on_load}
                introStartSeconds={movie.intro_start_seconds}
                introEndSeconds={movie.intro_end_seconds}
              />
            ) : canWatch && !needsLogin && isVideoUrlLoading ? (
              <div className="aspect-video bg-secondary rounded-none sm:rounded-lg flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div 
                className="aspect-video bg-secondary rounded-none sm:rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors relative overflow-hidden"
                onClick={handleWatchMovie}
              >
                {movie.poster_url && (
                  <img 
                    src={movie.poster_url} 
                    alt={movie.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                )}
                <div className="relative z-10 text-center space-y-4 p-4">
                  {checkingPayment ? (
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                  ) : needsLogin ? (
                    <>
                      <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">Đăng nhập để xem phim</p>
                        <p className="text-sm text-muted-foreground">Bạn cần có tài khoản để xem nội dung này</p>
                      </div>
                      <Button>Đăng nhập ngay</Button>
                    </>
                  ) : needsPayment ? (
                    <>
                      <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-green-500">₫</span>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">Yêu cầu thanh toán</p>
                        <p className="text-2xl font-bold text-green-500">
                          {(movie.payment_amount || 0).toLocaleString('vi-VN')}₫
                        </p>
                        {existingPayment?.status === 'pending' && (
                          <p className="text-sm text-yellow-500 mt-2">Đang chờ xác nhận thanh toán...</p>
                        )}
                      </div>
                      <Button>{existingPayment?.status === 'pending' ? 'Xem trạng thái' : 'Thanh toán ngay'}</Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm sm:text-base">Video chưa có sẵn</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Episode Selector - Above movie info */}
          {hasEpisodes && canWatch && !needsLogin && (
            <div className="px-2 sm:px-0">
              <EpisodeSelector 
                episodes={episodes} 
                currentEpisode={currentEpisode} 
                onSelectEpisode={handleSelectEpisode} 
              />
            </div>
          )}

          {/* Movie Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 px-2 sm:px-0">
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              {/* Title & Favorite Button */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl flex-1">{movie.title}</h1>
                
                {user ? (
                  <Button
                    onClick={handleToggleFavorite}
                    variant={isMovieFavorite ? "default" : "outline"}
                    className={`gap-2 shrink-0 w-full sm:w-auto ${isMovieFavorite ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                  >
                    <Heart className={`w-5 h-5 ${isMovieFavorite ? 'fill-current' : ''}`} />
                    {isMovieFavorite ? 'Đã yêu thích' : 'Yêu thích'}
                  </Button>
                ) : (
                  <Link to="/auth" className="w-full sm:w-auto">
                    <Button variant="outline" className="gap-2 w-full">
                      <Heart className="w-5 h-5" />
                      Đăng nhập để yêu thích
                    </Button>
                  </Link>
                )}
              </div>

              {/* Movie Meta */}
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                {movie.imdb_rating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" fill="currentColor" />
                    {movie.imdb_rating}
                  </span>
                )}
                {movie.release_year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    {movie.release_year}
                  </span>
                )}
                {movie.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    {movie.duration} phút
                  </span>
                )}
                {movie.has_episodes && movie.episode_count && (
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 sm:w-4 sm:h-4" />
                    {movie.episode_count} tập
                  </span>
                )}
                {movie.view_count && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                    {movie.view_count.toLocaleString()} lượt xem
                  </span>
                )}
              </div>

              {/* Genres */}
              {movie.genre && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {movie.genre.map(g => (
                    <span key={g} className="px-2 sm:px-3 py-0.5 sm:py-1 bg-secondary rounded-full text-xs sm:text-sm">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {movie.description && (
                <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                  {movie.description}
                </p>
              )}
            </div>

            {/* Side Info */}
            <div className="space-y-3 sm:space-y-4 glass-card p-3 sm:p-4">
              {movie.director && (
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Đạo diễn:</span>
                  <p className="font-medium text-sm sm:text-base">{movie.director}</p>
                </div>
              )}
              {movie.actors && movie.actors.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Diễn viên:</span>
                  <p className="font-medium text-sm sm:text-base">{movie.actors.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="px-2 sm:px-0">
            <MovieComments movieId={movie.id} />
          </div>

          {/* Related Movies */}
          {relatedMovies.length > 0 && (
            <div className="px-2 sm:px-0">
              <MovieRow title="Phim liên quan" movies={relatedMovies} />
            </div>
          )}
        </div>
      </main>
      <Footer />

      <LoginRequiredDialog 
        isOpen={showLoginDialog} 
        onClose={() => setShowLoginDialog(false)} 
      />

      {movie && showPaymentDialog && user && (
        <PaymentRequiredDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          movie={{
            id: movie.id,
            title: movie.title,
            payment_amount: movie.payment_amount,
            payment_image_url: movie.payment_image_url,
          }}
          userId={user.id}
          onPaymentSubmitted={handlePaymentSubmitted}
          existingPayment={existingPayment}
          userBalance={userInfo.balance}
          onPaidFromBalance={() => {
            setHasPaid(true);
            setShowPaymentDialog(false);
            fetchUserBalance();
          }}
        />
      )}
    </div>
  );
}
