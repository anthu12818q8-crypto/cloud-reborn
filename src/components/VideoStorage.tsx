import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, Film, Trash2, Check, X, Search, FolderOpen, RefreshCw, Play, Pause, FileVideo } from 'lucide-react';
import * as tus from 'tus-js-client';

interface StorageFile {
  id: string;
  name: string;
  size: number;
  created_at: string;
  url: string;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  uploadedBytes: number;
  error?: string;
  url?: string;
  tusUpload?: tus.Upload;
}

interface VideoStorageProps {
  onSelectVideo?: (url: string, filename: string) => void;
  selectMode?: boolean;
}

export function VideoStorage({ onSelectVideo, selectMode = false }: VideoStorageProps) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const activeUploadsRef = useRef<number>(0);
  const maxConcurrentUploads = 2;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage.from('videos').list('', {
        limit: 500,
        sortBy: { column: 'created_at', order: 'desc' }
      });

      if (error) throw error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const filesWithUrls: StorageFile[] = (data || [])
        .filter(f => f.name && f.id)
        .map(f => ({
          id: f.id!,
          name: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at || new Date().toISOString(),
          url: `${supabaseUrl}/storage/v1/object/public/videos/${f.name}`
        }));

      setFiles(filesWithUrls);
    } catch (error: any) {
      toast({
        title: 'Lỗi tải danh sách video',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const processUploadQueue = useCallback(async () => {
    const pendingItems = uploadQueue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      if (activeUploadsRef.current >= maxConcurrentUploads) break;
      
      activeUploadsRef.current++;
      setUploadQueue(prev => prev.map(u => 
        u.id === item.id ? { ...u, status: 'uploading' as const } : u
      ));

      await uploadFile(item);
      activeUploadsRef.current--;
    }
  }, [uploadQueue]);

  useEffect(() => {
    processUploadQueue();
  }, [uploadQueue, processUploadQueue]);

  const uploadFile = async (item: UploadItem) => {
    const file = item.file;
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Bạn cần đăng nhập');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const useTus = file.size > 6 * 1024 * 1024;

      if (useTus) {
        return new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
              authorization: `Bearer ${session.access_token}`,
              apikey: supabaseKey
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            metadata: {
              bucketName: 'videos',
              objectName: fileName,
              contentType: file.type || 'video/mp4',
              cacheControl: '3600'
            },
            chunkSize: 6 * 1024 * 1024,
            onError: (error) => {
              setUploadQueue(prev => prev.map(u =>
                u.id === item.id ? { ...u, status: 'error' as const, error: error.message } : u
              ));
              reject(error);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const progress = Math.round((bytesUploaded / bytesTotal) * 100);
              setUploadQueue(prev => prev.map(u =>
                u.id === item.id ? { ...u, progress, uploadedBytes: bytesUploaded } : u
              ));
            },
            onSuccess: () => {
              const url = `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`;
              setUploadQueue(prev => prev.map(u =>
                u.id === item.id ? { ...u, status: 'completed' as const, progress: 100, url } : u
              ));
              fetchFiles();
              resolve();
            }
          });

          setUploadQueue(prev => prev.map(u =>
            u.id === item.id ? { ...u, tusUpload: upload } : u
          ));

          upload.findPreviousUploads().then(prev => {
            if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
            upload.start();
          });
        });
      } else {
        return new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploadQueue(prev => prev.map(u =>
                u.id === item.id ? { ...u, progress, uploadedBytes: e.loaded } : u
              ));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const url = `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`;
              setUploadQueue(prev => prev.map(u =>
                u.id === item.id ? { ...u, status: 'completed' as const, progress: 100, url } : u
              ));
              fetchFiles();
              resolve();
            } else {
              setUploadQueue(prev => prev.map(u =>
                u.id === item.id ? { ...u, status: 'error' as const, error: 'Upload thất bại' } : u
              ));
              reject(new Error('Upload thất bại'));
            }
          });

          xhr.addEventListener('error', () => {
            setUploadQueue(prev => prev.map(u =>
              u.id === item.id ? { ...u, status: 'error' as const, error: 'Lỗi kết nối' } : u
            ));
            reject(new Error('Lỗi kết nối'));
          });

          xhr.open('POST', `${supabaseUrl}/storage/v1/object/videos/${fileName}`);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.setRequestHeader('apikey', supabaseKey);
          xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
          xhr.setRequestHeader('x-upsert', 'true');
          xhr.send(file);
        });
      }
    } catch (error: any) {
      setUploadQueue(prev => prev.map(u =>
        u.id === item.id ? { ...u, status: 'error' as const, error: error.message } : u
      ));
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newUploads: UploadItem[] = selectedFiles.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending' as const,
      uploadedBytes: 0
    }));

    setUploadQueue(prev => [...prev, ...newUploads]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cancelUpload = (itemId: string) => {
    const item = uploadQueue.find(u => u.id === itemId);
    if (item?.tusUpload) {
      item.tusUpload.abort();
    }
    setUploadQueue(prev => prev.map(u =>
      u.id === itemId ? { ...u, status: 'cancelled' as const } : u
    ));
  };

  const removeFromQueue = (itemId: string) => {
    setUploadQueue(prev => prev.filter(u => u.id !== itemId));
  };

  const deleteFile = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from('videos').remove([fileName]);
      if (error) throw error;
      
      setFiles(prev => prev.filter(f => f.name !== fileName));
      toast({ title: 'Đã xóa video' });
    } catch (error: any) {
      toast({
        title: 'Lỗi xóa video',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSelectVideo = (file: StorageFile) => {
    if (onSelectVideo) {
      onSelectVideo(file.url, file.name);
    }
  };

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUploads = uploadQueue.filter(u => 
    u.status === 'pending' || u.status === 'uploading'
  );
  const completedUploads = uploadQueue.filter(u => u.status === 'completed');
  const errorUploads = uploadQueue.filter(u => u.status === 'error');

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border-dashed border-2">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Tải lên video</h3>
              <p className="text-sm text-muted-foreground">
                Chọn nhiều file cùng lúc, hỗ trợ đến 3GB mỗi file
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Chọn video
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <FileVideo className="w-4 h-4" />
                Hàng đợi tải lên
                {activeUploads.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    {activeUploads.length} đang tải
                  </span>
                )}
              </h4>
              {completedUploads.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadQueue(prev => prev.filter(u => u.status !== 'completed'))}
                >
                  Xóa hoàn thành
                </Button>
              )}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {uploadQueue.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border ${
                    item.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                    item.status === 'error' ? 'bg-destructive/10 border-destructive/30' :
                    item.status === 'cancelled' ? 'bg-muted' :
                    'bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.status === 'completed' ? (
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : item.status === 'error' ? (
                        <X className="w-4 h-4 text-destructive flex-shrink-0" />
                      ) : (
                        <Film className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm truncate">{item.file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(item.status === 'pending' || item.status === 'uploading') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => cancelUpload(item.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {(item.status === 'completed' || item.status === 'error' || item.status === 'cancelled') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeFromQueue(item.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {(item.status === 'pending' || item.status === 'uploading') && (
                    <div className="space-y-1">
                      <Progress value={item.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {item.status === 'pending' ? 'Đang chờ...' : `${formatFileSize(item.uploadedBytes)} / ${formatFileSize(item.file.size)}`}
                        </span>
                        <span>{item.progress}%</span>
                      </div>
                    </div>
                  )}
                  
                  {item.status === 'error' && item.error && (
                    <p className="text-xs text-destructive">{item.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* File List */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Film className="w-4 h-4" />
              Kho video ({files.length})
            </h4>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm video..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={fetchFiles} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{searchQuery ? 'Không tìm thấy video' : 'Chưa có video trong kho'}</p>
            </div>
          ) : (
            <div className="grid gap-3 max-h-[400px] overflow-y-auto">
              {filteredFiles.map(file => (
                <div
                  key={file.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors ${
                    selectMode ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => selectMode && handleSelectVideo(file)}
                >
                  <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                    <Film className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {formatDate(file.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectMode ? (
                      <Button size="sm" variant="default" className="gap-1">
                        <Check className="w-3 h-3" />
                        Chọn
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewVideo(file.url);
                          }}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Xóa video này?')) {
                              deleteFile(file.name);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Xem trước video</DialogTitle>
          </DialogHeader>
          {previewVideo && (
            <video
              src={previewVideo}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
