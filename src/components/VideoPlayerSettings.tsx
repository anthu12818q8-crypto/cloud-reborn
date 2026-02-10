import { useState, useRef, useEffect } from 'react';
import { Settings, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPlayerSettingsProps {
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  quality: string | null;
  onQualityChange: (quality: string) => void;
  availableQualities: string[];
  detectedQuality?: string | null;
}

const PLAYBACK_SPEEDS = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: 'Bình thường', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '1.75x', value: 1.75 },
  { label: '2x', value: 2 },
];

export function VideoPlayerSettings({
  playbackRate,
  onPlaybackRateChange,
  quality,
  onQualityChange,
  availableQualities,
  detectedQuality,
}: VideoPlayerSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'speed' | 'quality' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSpeedChange = (speed: number) => {
    onPlaybackRateChange(speed);
    setActiveSubmenu(null);
    setIsOpen(false);
  };

  const handleQualityChange = (q: string) => {
    onQualityChange(q);
    setActiveSubmenu(null);
    setIsOpen(false);
  };

  const getCurrentSpeedLabel = () => {
    const speed = PLAYBACK_SPEEDS.find(s => s.value === playbackRate);
    return speed ? speed.label : `${playbackRate}x`;
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setIsOpen(!isOpen);
          setActiveSubmenu(null);
        }}
        className="h-8 w-8 sm:h-10 sm:w-10"
      >
        <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg min-w-[180px] overflow-hidden z-[70]">
          {activeSubmenu === null && (
            <div className="py-1">
              <button
                onClick={() => setActiveSubmenu('speed')}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/80 transition-colors"
              >
                <span className="text-sm">Tốc độ phát</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">{getCurrentSpeedLabel()}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
              
              {availableQualities.length > 1 && (
                <button
                  onClick={() => setActiveSubmenu('quality')}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-sm">Chất lượng</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">
                      {quality || 'Tự động'}
                      {detectedQuality && quality === detectedQuality && ' (Gốc)'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              )}
            </div>
          )}

          {activeSubmenu === 'speed' && (
            <div className="py-1 max-h-[300px] overflow-y-auto">
              <button
                onClick={() => setActiveSubmenu(null)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/80 border-b border-border"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Tốc độ phát
              </button>
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed.value}
                  onClick={() => handleSpeedChange(speed.value)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-sm">{speed.label}</span>
                  {playbackRate === speed.value && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {activeSubmenu === 'quality' && (
            <div className="py-1">
              <button
                onClick={() => setActiveSubmenu(null)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/80 border-b border-border"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Chất lượng
              </button>
              {availableQualities.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQualityChange(q)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-sm">
                    {q}
                    {detectedQuality && q === detectedQuality && (
                      <span className="ml-2 text-xs text-primary">(Gốc - HD)</span>
                    )}
                  </span>
                  {quality === q && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
