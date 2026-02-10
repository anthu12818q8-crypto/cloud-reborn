import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VideoStorage } from './VideoStorage';

interface VideoStorageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVideo?: (url: string, filename: string) => void;
  selectMode?: boolean;
}

export function VideoStorageDialog({
  open,
  onOpenChange,
  onSelectVideo,
  selectMode = false
}: VideoStorageDialogProps) {
  const handleSelectVideo = (url: string, filename: string) => {
    if (onSelectVideo) {
      onSelectVideo(url, filename);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectMode ? 'Chọn video từ kho' : 'Kho lưu trữ video'}
          </DialogTitle>
        </DialogHeader>
        <VideoStorage
          onSelectVideo={handleSelectVideo}
          selectMode={selectMode}
        />
      </DialogContent>
    </Dialog>
  );
}
