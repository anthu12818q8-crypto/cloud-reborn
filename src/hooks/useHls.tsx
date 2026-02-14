import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

interface HlsQualityLevel {
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

interface UseHlsOptions {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
}

export function useHls({ src, videoRef, enabled = true }: UseHlsOptions) {
  const hlsRef = useRef<Hls | null>(null);
  const [isHls, setIsHls] = useState(false);
  const [hlsLevels, setHlsLevels] = useState<HlsQualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto

  const isHlsSource = useCallback((url: string) => {
    return url?.includes('.m3u8') || url?.includes('master.m3u8');
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !enabled) return;

    // Check if it's an HLS source
    if (!isHlsSource(src)) {
      setIsHls(false);
      setHlsLevels([]);
      return;
    }

    // If native HLS is supported (Safari), use it directly
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      setIsHls(true);
      video.src = src;
      // Safari handles quality switching natively
      return;
    }

    // Use hls.js for other browsers
    if (!Hls.isSupported()) {
      // Fallback: try direct playback
      video.src = src;
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startLevel: -1, // Auto-select starting quality
      capLevelToPlayerSize: true, // Don't load higher quality than video element size
    });

    hlsRef.current = hls;
    setIsHls(true);

    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      const levels: HlsQualityLevel[] = data.levels.map((level, _index) => {
        let label = `${level.height}p`;
        if (level.height >= 2160) label = '4K';
        else if (level.height >= 1440) label = '1440p';

        return {
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          label,
        };
      });

      // Sort from highest to lowest
      levels.sort((a, b) => b.height - a.height);
      setHlsLevels(levels);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      setCurrentLevel(data.level);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
      setIsHls(false);
      setHlsLevels([]);
    };
  }, [src, enabled, videoRef, isHlsSource]);

  const setQualityLevel = useCallback((levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    // -1 = auto, otherwise index into levels array
    hls.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
  }, []);

  const getAvailableQualities = useCallback((): string[] => {
    if (!isHls || hlsLevels.length === 0) return [];
    return ['Tự động', ...hlsLevels.map(l => l.label)];
  }, [isHls, hlsLevels]);

  const setQualityByLabel = useCallback((label: string) => {
    if (label === 'Tự động') {
      setQualityLevel(-1);
      return;
    }
    const index = hlsLevels.findIndex(l => l.label === label);
    if (index !== -1) {
      setQualityLevel(index);
    }
  }, [hlsLevels, setQualityLevel]);

  const getCurrentQualityLabel = useCallback((): string => {
    if (currentLevel === -1) return 'Tự động';
    if (currentLevel >= 0 && currentLevel < hlsLevels.length) {
      return hlsLevels[currentLevel].label;
    }
    return 'Tự động';
  }, [currentLevel, hlsLevels]);

  return {
    isHls,
    hlsLevels,
    currentLevel,
    setQualityLevel,
    setQualityByLabel,
    getAvailableQualities,
    getCurrentQualityLabel,
    hlsInstance: hlsRef.current,
  };
}
