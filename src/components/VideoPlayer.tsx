import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Maximize, Minimize, RotateCcw, FastForward } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { VideoPlayerSettings } from '@/components/VideoPlayerSettings';
import { applyVideoProtection, addVideoWatermark, isDevToolsOpen } from '@/lib/videoProtection';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  onPlay?: () => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  savedProgress?: number;
  onSaveProgress?: (progress: number, duration: number) => void;
  onClearProgress?: () => void;
  adVideoUrl?: string | null;
  adPosition?: string | null;
  adShowOnLoad?: boolean | null;
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
}

export function VideoPlayer({
  src,
  poster,
  title,
  onPlay,
  onPlayingChange,
  savedProgress = 0,
  onSaveProgress,
  onClearProgress,
  adVideoUrl,
  adPosition = 'start',
  adShowOnLoad = false,
  introStartSeconds,
  introEndSeconds,
}: VideoPlayerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [hasShownResumeDialog, setHasShownResumeDialog] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Video loading state
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  
  // Video quality detection
  const [detectedQuality, setDetectedQuality] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<string[]>(['Tự động']);
  
  // Settings state
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState<string | null>(null); // null means auto-select best
  
  // Ad state
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [canSkipAd, setCanSkipAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [adTriggeredAt, setAdTriggeredAt] = useState<string | null>(null);
  
  // Intro skip state
  const [showIntroSkip, setShowIntroSkip] = useState(false);
  
  // DevTools detection state
  const [devToolsDetected, setDevToolsDetected] = useState(false);

  // Show ad on page load if configured
  useEffect(() => {
    if (adVideoUrl && adShowOnLoad && !adWatched && !adTriggeredAt) {
      // Trigger ad immediately on mount
      setTimeout(() => {
        triggerAd('onload');
      }, 500);
    }
  }, [adVideoUrl, adShowOnLoad]);

  // Apply video protection and watermark on mount
  useEffect(() => {
    if (videoRef.current) {
      applyVideoProtection(videoRef.current);
    }
    if (adVideoRef.current) {
      applyVideoProtection(adVideoRef.current);
    }
    if (containerRef.current && user) {
      addVideoWatermark(containerRef.current, user.id, user.email || undefined);
    }
  }, [user]);

  // DevTools detection - pause video if detected in production
  useEffect(() => {
    if (import.meta.env.DEV) return;
    
    const checkInterval = setInterval(() => {
      const isOpen = isDevToolsOpen();
      if (isOpen && !devToolsDetected) {
        setDevToolsDetected(true);
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          logger.warn('Video paused - DevTools detected');
        }
      } else if (!isOpen && devToolsDetected) {
        setDevToolsDetected(false);
      }
    }, 1000);
    
    return () => clearInterval(checkInterval);
  }, [devToolsDetected]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Screen capture protection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        navigator.clipboard.writeText('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) {
        e.preventDefault();
        return;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current && isPlaying) {
        videoRef.current.pause();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isPlaying]);

  // Check for saved progress on mount
  useEffect(() => {
    if (savedProgress > 0 && !hasShownResumeDialog) {
      setShowResumeDialog(true);
      setHasShownResumeDialog(true);
    }
  }, [savedProgress, hasShownResumeDialog]);

  // Ad countdown timer
  useEffect(() => {
    if (!isPlayingAd) return;
    
    const timer = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          setCanSkipAd(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlayingAd]);

  // Check for intro skip timing
  useEffect(() => {
    if (introStartSeconds != null && introEndSeconds != null && !isPlayingAd) {
      const inIntroRange = currentTime >= introStartSeconds && currentTime < introEndSeconds;
      setShowIntroSkip(inIntroRange);
    } else {
      setShowIntroSkip(false);
    }
  }, [currentTime, introStartSeconds, introEndSeconds, isPlayingAd]);

  // Save progress periodically
  const saveCurrentProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !onSaveProgress || isPlayingAd) return;
    onSaveProgress(video.currentTime, video.duration);
  }, [onSaveProgress, isPlayingAd]);

  // Parse ad position - can be 'start', 'middle', 'end' or a number (seconds)
  const getAdPositionSeconds = (): number | null => {
    if (!adPosition) return null;
    if (adPosition === 'start') return 0;
    if (adPosition === 'middle') return duration > 0 ? duration / 2 : null;
    if (adPosition === 'end') return null; // handled separately
    const seconds = parseInt(adPosition);
    return isNaN(seconds) ? null : seconds;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      if (!isPlayingAd) {
        setCurrentTime(video.currentTime);
        
        // Check for ad trigger based on position (only if not using ad_show_on_load)
        if (adVideoUrl && !adShowOnLoad && !adWatched && duration > 0 && !adTriggeredAt) {
          const adPosSeconds = getAdPositionSeconds();
          if (adPosSeconds !== null && video.currentTime >= adPosSeconds) {
            triggerAd(adPosition || 'start');
          }
        }
      }
      
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
      saveProgressTimeoutRef.current = setTimeout(saveCurrentProgress, 10000);
    };
    
    // Detect video resolution when metadata loads
    const handleLoadedMetadata = () => {
      const videoHeight = video.videoHeight;
      const videoWidth = video.videoWidth;
      setDuration(video.duration || 0);
      
      // Detect original video quality
      let originalQuality = '480p';
      if (videoHeight >= 2160) originalQuality = '4K';
      else if (videoHeight >= 1440) originalQuality = '1440p';
      else if (videoHeight >= 1080) originalQuality = '1080p';
      else if (videoHeight >= 720) originalQuality = '720p';
      else if (videoHeight >= 480) originalQuality = '480p';
      else originalQuality = '360p';
      
      setDetectedQuality(originalQuality);
      
      // Build available qualities based on original
      const allQualities = ['4K', '1440p', '1080p', '720p', '480p', '360p'];
      const originalIndex = allQualities.indexOf(originalQuality);
      const available = ['Tự động', ...allQualities.slice(originalIndex)];
      setAvailableQualities(available);
      
      // Set default quality to the highest (original)
      if (!quality) {
        setQuality(originalQuality);
      }
      
      setVideoReady(true);
      setIsVideoLoading(false);
      setLoadingProgress(100);
      
      logger.info(`Video detected: ${videoWidth}x${videoHeight} (${originalQuality})`);
    };
    
    // Track video loading progress
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const loadedPercent = (bufferedEnd / video.duration) * 100;
        setLoadingProgress(Math.min(loadedPercent, 100));
      }
    };
    
    const handleWaiting = () => {
      setIsVideoLoading(true);
    };
    
    const handleCanPlay = () => {
      setIsVideoLoading(false);
      setVideoReady(true);
    };
    
    
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    
    const handlePlay = () => {
      if (!isPlayingAd) {
        setIsPlaying(true);
        onPlayingChange?.(true);
      }
    };
    
    const handlePause = () => {
      if (!isPlayingAd) {
        setIsPlaying(false);
        onPlayingChange?.(false);
        saveCurrentProgress();
      }
    };
    
    const handleEnded = () => {
      if (adVideoUrl && adPosition === 'end' && !adWatched && adTriggeredAt !== 'end') {
        triggerAd('end');
        return;
      }
      
      setIsPlaying(false);
      setShowControls(true);
      onPlayingChange?.(false);
      onClearProgress?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      
      if (video.currentTime > 0) {
        saveCurrentProgress();
      }
    };
  }, [onPlayingChange, saveCurrentProgress, onClearProgress, isPlayingAd, adVideoUrl, adPosition, adWatched, duration, adTriggeredAt]);

  // Save progress when page is about to unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveCurrentProgress]);

  const triggerAd = (position: string) => {
    if (!adVideoUrl) return;
    
    setAdTriggeredAt(position);
    setIsPlayingAd(true);
    setAdCountdown(5);
    setCanSkipAd(false);
    
    videoRef.current?.pause();
    
    setTimeout(() => {
      adVideoRef.current?.play().catch(logger.error);
    }, 100);
  };

  const skipAd = () => {
    if (!canSkipAd) return;
    
    // Stop ad video and its audio
    if (adVideoRef.current) {
      adVideoRef.current.pause();
      adVideoRef.current.currentTime = 0;
    }
    
    setIsPlayingAd(false);
    setAdWatched(true);
    
    if (adTriggeredAt === 'start' || adTriggeredAt === 'middle' || adTriggeredAt === 'onload') {
      videoRef.current?.play().catch(logger.error);
    }
  };

  const handleAdEnded = () => {
    // Stop ad video completely
    if (adVideoRef.current) {
      adVideoRef.current.pause();
      adVideoRef.current.currentTime = 0;
    }
    
    setIsPlayingAd(false);
    setAdWatched(true);
    
    if (adTriggeredAt === 'start' || adTriggeredAt === 'middle' || adTriggeredAt === 'onload') {
      videoRef.current?.play().catch(logger.error);
    }
  };

  const handleResume = () => {
    const video = videoRef.current;
    if (video && savedProgress > 0) {
      video.currentTime = savedProgress;
    }
    setShowResumeDialog(false);
    togglePlay();
  };

  const handleStartOver = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
    }
    onClearProgress?.();
    setShowResumeDialog(false);
    togglePlay();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || isPlayingAd) return;
    
    if (video.paused || video.ended) {
      // Check if ad should play at start (position 0 or 'start') - skip if using ad_show_on_load
      if (!adShowOnLoad) {
        const adPosSeconds = getAdPositionSeconds();
        if (adVideoUrl && (adPosSeconds === 0 || adPosition === 'start') && !adWatched && !adTriggeredAt) {
          triggerAd('start');
          return;
        }
      }
      
      video.play().then(() => {
        onPlay?.();
      }).catch(error => {
        logger.error('Video play error:', error);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  };

  const handlePlayClick = () => {
    setHasStartedWatching(true);
    if (savedProgress > 0 && !hasShownResumeDialog) {
      setShowResumeDialog(true);
      setHasShownResumeDialog(true);
      return;
    }
    togglePlay();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || isPlayingAd) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video || isPlayingAd) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const skipIntro = () => {
    const video = videoRef.current;
    if (!video || introEndSeconds == null) return;
    video.currentTime = introEndSeconds;
    setShowIntroSkip(false);
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isPlayingAd) setShowControls(false);
    }, 5000);
  };

  const handleInteraction = () => {
    resetControlsTimeout();
  };

  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-background rounded-none sm:rounded-lg overflow-hidden group isolate"
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
        onMouseLeave={() => isPlaying && !isPlayingAd && setShowControls(false)}
        style={{
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Main Video - Optimized for performance */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className={`w-full h-full object-contain ${isPlayingAd ? 'hidden' : ''}`}
          preload="metadata"
          playsInline
          onClick={handlePlayClick}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Ad Video */}
        {adVideoUrl && (
          <video
            ref={adVideoRef}
            src={adVideoUrl}
            className={`w-full h-full object-contain ${isPlayingAd ? '' : 'hidden'}`}
            playsInline
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            onEnded={handleAdEnded}
          />
        )}

        {/* DevTools Warning Overlay */}
        {devToolsDetected && !import.meta.env.DEV && (
          <div className="absolute inset-0 z-[70] bg-background/95 flex items-center justify-center">
            <div className="text-center p-6 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-destructive/20 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Nội dung được bảo vệ</h3>
              <p className="text-muted-foreground mb-4">
                Vui lòng đóng công cụ nhà phát triển để tiếp tục xem phim.
              </p>
              <p className="text-xs text-muted-foreground">
                Hệ thống đã phát hiện công cụ có thể dùng để tải video trái phép.
              </p>
            </div>
          </div>
        )}

        {/* Ad Skip Overlay */}
        {isPlayingAd && (
          <div className="absolute inset-0 z-[60]">
            <div className="absolute top-4 left-4 bg-accent text-accent-foreground px-3 py-1 rounded text-sm font-bold">
              Quảng cáo
            </div>
            
            <div className="absolute bottom-20 right-4">
              {canSkipAd ? (
                <Button 
                  onClick={skipAd}
                  variant="secondary"
                  className="font-medium gap-2"
                >
                  <FastForward className="w-4 h-4" />
                  Bỏ qua quảng cáo
                </Button>
              ) : (
                <div className="bg-background/80 text-foreground px-4 py-2 rounded">
                  Bỏ qua quảng cáo sau {adCountdown} giây
                </div>
              )}
            </div>
          </div>
        )}

        {/* Intro Skip Button */}
        {showIntroSkip && !isPlayingAd && (
          <div className="absolute bottom-20 right-4 z-[55]">
            <Button 
              onClick={skipIntro}
              variant="secondary"
              className="font-medium gap-2"
            >
              <FastForward className="w-4 h-4" />
              Bỏ qua giới thiệu
            </Button>
          </div>
        )}

        {/* Loading Overlay */}
        {isVideoLoading && hasStartedWatching && !isPlayingAd && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 z-[55]">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20">
              <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
                <circle
                  className="stroke-muted"
                  strokeWidth="8"
                  fill="none"
                  r="42"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="stroke-primary"
                  strokeWidth="8"
                  fill="none"
                  r="42"
                  cx="50"
                  cy="50"
                  strokeDasharray={`${loadingProgress * 2.64} 264`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {Math.round(loadingProgress)}%
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Đang tải...</p>
          </div>
        )}

        {/* Play Button Overlay */}
        {!isPlaying && !isPlayingAd && !isVideoLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/30 cursor-pointer"
            onClick={handlePlayClick}
          >
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform">
              <Play className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground ml-1" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Controls */}
        {!isPlayingAd && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-3 sm:p-4 pb-[max(12px,env(safe-area-inset-bottom))] transition-opacity duration-300 z-50 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Progress Bar */}
            <div className="mb-3 sm:mb-4">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-1">
              {/* Left Controls */}
              <div className="flex items-center gap-1 min-w-0">
                {/* Skip Back 15s */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => skip(-15)}
                  className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                  title="Tua lùi 15 giây"
                >
                  <div className="relative">
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">15</span>
                  </div>
                </Button>

                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePlayClick}
                  className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-6 sm:h-6" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-6 sm:h-6" fill="currentColor" />
                  )}
                </Button>

                {/* Skip Forward 15s */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => skip(15)}
                  className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                  title="Tua tới 15 giây"
                >
                  <div className="relative">
                    <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 scale-x-[-1]" />
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">15</span>
                  </div>
                </Button>

                {/* Time display */}
                <span className="text-[10px] sm:text-sm text-muted-foreground whitespace-nowrap font-mono ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {title && (
                  <span className="hidden lg:inline text-sm font-medium mr-2 max-w-xs truncate">
                    {title}
                  </span>
                )}
                
                {/* Settings */}
                <VideoPlayerSettings
                  playbackRate={playbackRate}
                  onPlaybackRateChange={setPlaybackRate}
                  quality={quality}
                  onQualityChange={setQuality}
                  availableQualities={availableQualities}
                  detectedQuality={detectedQuality}
                />
                
                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 bg-primary/20 hover:bg-primary/40"
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resume Dialog */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Tiếp tục xem?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đã xem đến {formatTime(savedProgress)}. Bạn muốn tiếp tục xem hay bắt đầu lại từ đầu?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleStartOver} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Bắt đầu lại
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResume} className="gap-2 bg-primary">
              <Play className="w-4 h-4" fill="currentColor" />
              Tiếp tục ({formatTime(savedProgress)})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
