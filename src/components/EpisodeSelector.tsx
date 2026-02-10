import { Episode } from '@/types/database';
import { Play } from 'lucide-react';

interface EpisodeSelectorProps {
  episodes: Episode[];
  currentEpisode: number;
  onSelectEpisode: (episodeNumber: number) => void;
}

export function EpisodeSelector({ episodes, currentEpisode, onSelectEpisode }: EpisodeSelectorProps) {
  if (episodes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Danh sách tập</h3>
      <div className="flex flex-wrap gap-2">
        {episodes.map((ep) => (
          <button
            key={ep.id}
            onClick={() => onSelectEpisode(ep.episode_number)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
              ${currentEpisode === ep.episode_number
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary/50 border-border hover:bg-secondary hover:border-primary/50'
              }
            `}
          >
            {currentEpisode === ep.episode_number && (
              <Play className="w-3 h-3" fill="currentColor" />
            )}
            <span className="font-medium">Tập {ep.episode_number}</span>
            {ep.title && (
              <span className="text-xs opacity-75 max-w-[100px] truncate">
                {ep.title}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
