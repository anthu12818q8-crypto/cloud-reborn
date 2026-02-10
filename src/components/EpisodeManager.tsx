import { useState, useRef } from 'react';
import { Plus, Trash2, Film, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useEpisodes } from '@/hooks/useEpisodes';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as tus from 'tus-js-client';
import { Episode } from '@/types/database';

interface EpisodeManagerProps {
  movieId: string;
  episodeCount: number;
}

export function EpisodeManager({ movieId, episodeCount }: EpisodeManagerProps) {
  const { episodes, addEpisode, deleteEpisode, refetch } = useEpisodes(movieId);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingEpisode, setUploadingEpisode] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const uploadRef = useRef<tus.Upload | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const uploadEpisodeVideo = async (episodeNumber: number, file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${movieId}_ep${episodeNumber}_${Date.now()}.${ext}`;
    
    setUploading(true);
    setUploadProgress(0);
    setUploadingEpisode(episodeNumber);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Bạn cần đăng nhập để upload file');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const useTus = file.size > 6 * 1024 * 1024;
      
      if (useTus) {
        return new Promise((resolve, reject) => {
          const upload = new tus.Upload(file, {
            endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: { authorization: `Bearer ${session.access_token}`, apikey: supabaseKey },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            metadata: { bucketName: 'videos', objectName: fileName, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
            chunkSize: 6 * 1024 * 1024,
            onError: (error) => { 
              setUploading(false); 
              setUploadingEpisode(null); 
              uploadRef.current = null; 
              reject(new Error(error.message || 'Upload thất bại')); 
            },
            onProgress: (bytesUploaded, bytesTotal) => { 
              setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100)); 
            },
            onSuccess: () => { 
              setUploading(false); 
              setUploadingEpisode(null); 
              uploadRef.current = null; 
              resolve(`${supabaseUrl}/storage/v1/object/public/videos/${fileName}`); 
            },
          });
          uploadRef.current = upload;
          upload.findPreviousUploads().then((prev) => { 
            if (prev.length) upload.resumeFromPreviousUpload(prev[0]); 
            upload.start(); 
          });
        });
      } else {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', (e) => { 
            if (e.lengthComputable) { 
              setUploadProgress(Math.round((e.loaded / e.total) * 100)); 
            } 
          });
          xhr.addEventListener('load', () => { 
            setUploading(false); 
            setUploadingEpisode(null); 
            xhr.status >= 200 && xhr.status < 300 
              ? resolve(`${supabaseUrl}/storage/v1/object/public/videos/${fileName}`) 
              : reject(new Error('Upload thất bại')); 
          });
          xhr.addEventListener('error', () => { 
            setUploading(false); 
            setUploadingEpisode(null); 
            reject(new Error('Lỗi kết nối mạng')); 
          });
          xhr.open('POST', `${supabaseUrl}/storage/v1/object/videos/${fileName}`);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.setRequestHeader('apikey', supabaseKey);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.setRequestHeader('x-upsert', 'true');
          xhr.send(file);
        });
      }
    } catch (error) {
      setUploading(false);
      setUploadingEpisode(null);
      throw error;
    }
  };

  const handleUploadEpisode = async (episodeNumber: number, file: File) => {
    if (file.size > 3 * 1024 * 1024 * 1024) {
      toast({ title: 'File quá lớn', description: 'Video không được vượt quá 3GB', variant: 'destructive' });
      return;
    }

    try {
      const videoUrl = await uploadEpisodeVideo(episodeNumber, file);
      
      // Check if episode already exists
      const existingEp = episodes.find(e => e.episode_number === episodeNumber);
      if (existingEp) {
        // Update existing episode
        const { error } = await supabase
          .from('episodes')
          .update({ video_url: videoUrl })
          .eq('id', existingEp.id);
        if (error) throw error;
        toast({ title: `Đã cập nhật tập ${episodeNumber}` });
      } else {
        // Add new episode
        await addEpisode({
          movie_id: movieId,
          episode_number: episodeNumber,
          title: null,
          video_url: videoUrl,
          duration: null,
        });
      }
      refetch();
    } catch (error: any) {
      toast({ title: 'Lỗi upload', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    await deleteEpisode(episodeId);
  };

  const cancelUpload = () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setUploading(false);
    setUploadingEpisode(null);
    setUploadProgress(0);
    toast({ title: 'Đã hủy upload' });
  };

  // Generate episode slots
  const episodeSlots = Array.from({ length: episodeCount }, (_, i) => i + 1);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Film className="w-4 h-4" />
          Quản lý tập ({episodes.length}/{episodeCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quản lý tập phim</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {episodeSlots.map((epNum) => {
            const episode = episodes.find(e => e.episode_number === epNum);
            const isUploading = uploading && uploadingEpisode === epNum;
            
            return (
              <div key={epNum} className="flex items-center gap-4 p-3 rounded-lg border bg-secondary/30">
                <div className="flex-shrink-0 w-16 h-10 bg-primary/20 rounded flex items-center justify-center font-bold">
                  Tập {epNum}
                </div>
                
                <div className="flex-1 min-w-0">
                  {episode ? (
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <Film className="w-4 h-4" />
                      <span className="truncate">Đã upload</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Chưa có video</span>
                  )}
                  
                  {isUploading && (
                    <div className="mt-2 space-y-1">
                      <Progress value={uploadProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Đang tải...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {isUploading ? (
                    <Button variant="ghost" size="sm" onClick={cancelUpload}>
                      <X className="w-4 h-4" />
                    </Button>
                  ) : (
                    <>
                      <Label className="cursor-pointer">
                        <Input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadEpisode(epNum, file);
                          }}
                          disabled={uploading}
                        />
                        <div className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                          <Upload className="w-4 h-4" />
                          {episode ? 'Thay' : 'Tải'}
                        </div>
                      </Label>
                      
                      {episode && (
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteEpisode(episode.id)}
                          disabled={uploading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          
          {episodeSlots.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Chưa có tập nào được cấu hình
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
