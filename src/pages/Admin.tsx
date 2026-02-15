import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Film, ArrowLeft, X, Users, CreditCard, Shield, Ban, Unlock, DollarSign, Check, XCircle, Image, MessageSquare, SkipForward, Layers, Megaphone, Smartphone, HardDrive, FolderOpen, Crown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useMovies } from '@/hooks/useMovies';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GENRES } from '@/types/database';
import { Progress } from '@/components/ui/progress';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useAdminPayments } from '@/hooks/usePayment';
import { useAdminComplaints } from '@/hooks/useComplaints';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import * as tus from 'tus-js-client';
import { EpisodeManager } from '@/components/EpisodeManager';
import { DeviceManagement } from '@/components/DeviceManagement';
import { VideoStorage } from '@/components/VideoStorage';
import { VideoStorageDialog } from '@/components/VideoStorageDialog';
import { AdminTiers } from '@/components/AdminTiers';
import { AdminDeposits } from '@/components/AdminDeposits';
import { AdminAnnouncements } from '@/components/AdminAnnouncements';

export default function Admin() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { movies, addMovie, updateMovie, deleteMovie, fetchMovies } = useMovies();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('movies');
  const [form, setForm] = useState({
    title: '', description: '', genre: [] as string[], release_year: '', duration: '',
    actors: '', director: '', imdb_rating: '', is_featured: false, display_order: '0',
    poster_url: '', video_url: '', video_filename: '', requires_payment: false, payment_amount: '', payment_image_url: '',
    ad_video_url: '', ad_video_filename: '', ad_position_hours: '', ad_position_minutes: '', ad_position_seconds: '', 
    ad_enabled: false, ad_show_on_load: false,
    intro_start_seconds: '', intro_end_seconds: '',
    has_episodes: false, episode_count: ''
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/');
  }, [user, isAdmin, authLoading, navigate]);

  const [uploadType, setUploadType] = useState<'poster' | 'video' | 'payment' | 'ad' | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState(0);
  const [totalFileSize, setTotalFileSize] = useState(0);
  const uploadRef = useRef<tus.Upload | null>(null);
  const [videoStorageDialogOpen, setVideoStorageDialogOpen] = useState(false);
  const [videoStorageSelectType, setVideoStorageSelectType] = useState<'video' | 'ad'>('video');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const cancelUpload = () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setUploading(false);
    setUploadType(null);
    setUploadProgress(0);
    toast({ title: 'Đã hủy upload' });
  };

  const uploadFileWithProgress = async (file: File, bucket: string, type: 'poster' | 'video' | 'payment' | 'ad'): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    
    setUploading(true);
    setUploadProgress(0);
    setUploadType(type);
    setTotalFileSize(file.size);
    setUploadedFileSize(0);

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
            metadata: { bucketName: bucket, objectName: fileName, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
            chunkSize: 6 * 1024 * 1024,
            onError: (error) => { setUploading(false); setUploadType(null); uploadRef.current = null; reject(new Error(error.message || 'Upload thất bại')); },
            onProgress: (bytesUploaded, bytesTotal) => { setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100)); setUploadedFileSize(bytesUploaded); },
            onSuccess: () => { setUploading(false); setUploadType(null); uploadRef.current = null; resolve(`${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`); },
          });
          uploadRef.current = upload;
          upload.findPreviousUploads().then((prev) => { if (prev.length) upload.resumeFromPreviousUpload(prev[0]); upload.start(); });
        });
      } else {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) { setUploadProgress(Math.round((e.loaded / e.total) * 100)); setUploadedFileSize(e.loaded); } });
          xhr.addEventListener('load', () => { setUploading(false); setUploadType(null); xhr.status >= 200 && xhr.status < 300 ? resolve(`${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`) : reject(new Error('Upload thất bại')); });
          xhr.addEventListener('error', () => { setUploading(false); setUploadType(null); reject(new Error('Lỗi kết nối mạng')); });
          xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.setRequestHeader('apikey', supabaseKey);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.setRequestHeader('x-upsert', 'true');
          xhr.send(file);
        });
      }
    } catch (error) {
      setUploading(false);
      setUploadType(null);
      throw error;
    }
  };

  // Calculate ad position in seconds from hours, minutes, seconds
  const calculateAdPositionSeconds = () => {
    const hours = parseInt(form.ad_position_hours) || 0;
    const minutes = parseInt(form.ad_position_minutes) || 0;
    const seconds = parseInt(form.ad_position_seconds) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adPositionSeconds = calculateAdPositionSeconds();
    const movieData = {
      title: form.title,
      description: form.description || null,
      genre: form.genre.length > 0 ? form.genre : null,
      release_year: form.release_year ? parseInt(form.release_year) : null,
      duration: form.duration ? parseInt(form.duration) : null,
      actors: form.actors ? form.actors.split(',').map(a => a.trim()) : null,
      director: form.director || null,
      imdb_rating: form.imdb_rating ? parseFloat(form.imdb_rating) : null,
      is_featured: form.is_featured,
      display_order: form.is_featured ? parseInt(form.display_order) || 0 : 0,
      poster_url: form.poster_url || null,
      video_url: form.has_episodes ? null : (form.video_url || null),
      created_by: user?.id,
      requires_payment: form.requires_payment,
      payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : 0,
      payment_image_url: form.payment_image_url || null,
      ad_video_url: form.ad_enabled ? (form.ad_video_url || null) : null,
      ad_position: adPositionSeconds > 0 ? adPositionSeconds.toString() : 'start',
      ad_enabled: form.ad_enabled,
      ad_show_on_load: form.ad_show_on_load,
      intro_start_seconds: form.intro_start_seconds ? parseInt(form.intro_start_seconds) : null,
      intro_end_seconds: form.intro_end_seconds ? parseInt(form.intro_end_seconds) : null,
      has_episodes: form.has_episodes,
      episode_count: form.episode_count ? parseInt(form.episode_count) : 0,
    };
    if (editingMovie) await updateMovie(editingMovie.id, movieData);
    else await addMovie(movieData);
    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setForm({ title: '', description: '', genre: [], release_year: '', duration: '', actors: '', director: '', imdb_rating: '', is_featured: false, display_order: '0', poster_url: '', video_url: '', video_filename: '', requires_payment: false, payment_amount: '', payment_image_url: '', ad_video_url: '', ad_video_filename: '', ad_position_hours: '', ad_position_minutes: '', ad_position_seconds: '', ad_enabled: false, ad_show_on_load: false, intro_start_seconds: '', intro_end_seconds: '', has_episodes: false, episode_count: '' });
    setEditingMovie(null);
  };

  // Parse ad position from seconds to hours, minutes, seconds
  const parseAdPosition = (position: string | null) => {
    if (!position || position === 'start' || position === 'middle' || position === 'end') {
      return { hours: '', minutes: '', seconds: '' };
    }
    const totalSeconds = parseInt(position) || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      hours: hours > 0 ? hours.toString() : '',
      minutes: minutes > 0 ? minutes.toString() : '',
      seconds: seconds > 0 ? seconds.toString() : ''
    };
  };

  // Extract filename from URL
  const getFilenameFromUrl = (url: string | null) => {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1] || '';
  };

  const handleEdit = (movie: any) => {
    setEditingMovie(movie);
    const adPos = parseAdPosition(movie.ad_position);
    setForm({
      title: movie.title, description: movie.description || '', genre: movie.genre || [],
      release_year: movie.release_year?.toString() || '', duration: movie.duration?.toString() || '',
      actors: movie.actors?.join(', ') || '', director: movie.director || '',
      imdb_rating: movie.imdb_rating?.toString() || '', is_featured: movie.is_featured || false,
      display_order: movie.display_order?.toString() || '0', poster_url: movie.poster_url || '',
      video_url: movie.video_url || '', video_filename: getFilenameFromUrl(movie.video_url),
      requires_payment: movie.requires_payment || false,
      payment_amount: movie.payment_amount?.toString() || '', payment_image_url: movie.payment_image_url || '',
      ad_video_url: movie.ad_video_url || '', ad_video_filename: getFilenameFromUrl(movie.ad_video_url),
      ad_position_hours: adPos.hours, ad_position_minutes: adPos.minutes, ad_position_seconds: adPos.seconds,
      ad_enabled: movie.ad_enabled || false, ad_show_on_load: movie.ad_show_on_load || false,
      intro_start_seconds: movie.intro_start_seconds?.toString() || '', intro_end_seconds: movie.intro_end_seconds?.toString() || '',
      has_episodes: movie.has_episodes || false, episode_count: movie.episode_count?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bucket: string, type: 'poster' | 'video' | 'payment' | 'ad', field: string, filenameField?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if ((type === 'video' || type === 'ad') && file.size > 3 * 1024 * 1024 * 1024) {
      toast({ title: 'File quá lớn', description: 'Video không được vượt quá 3GB', variant: 'destructive' });
      return;
    }
    try {
      const url = await uploadFileWithProgress(file, bucket, type);
      setForm(prev => ({ 
        ...prev, 
        [field]: url,
        ...(filenameField ? { [filenameField]: file.name } : {})
      }));
      toast({ title: `Upload ${type} thành công` });
    } catch (error: any) {
      if (error.message !== 'Upload đã bị hủy') toast({ title: `Lỗi upload ${type}`, description: error.message, variant: 'destructive' });
    }
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="font-display text-3xl">Quản trị</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-max">
              <TabsTrigger value="movies" className="gap-1.5 text-xs md:text-sm"><Film className="w-4 h-4" /><span className="hidden sm:inline">Phim</span></TabsTrigger>
              <TabsTrigger value="storage" className="gap-1.5 text-xs md:text-sm"><HardDrive className="w-4 h-4" /><span className="hidden sm:inline">Kho phim</span></TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5 text-xs md:text-sm"><Users className="w-4 h-4" /><span className="hidden sm:inline">Người dùng</span></TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 text-xs md:text-sm"><CreditCard className="w-4 h-4" /><span className="hidden sm:inline">Thanh toán</span></TabsTrigger>
              <TabsTrigger value="complaints" className="gap-1.5 text-xs md:text-sm"><MessageSquare className="w-4 h-4" /><span className="hidden sm:inline">Khiếu nại</span></TabsTrigger>
              <TabsTrigger value="devices" className="gap-1.5 text-xs md:text-sm"><Smartphone className="w-4 h-4" /><span className="hidden sm:inline">Thiết bị</span></TabsTrigger>
              <TabsTrigger value="tiers" className="gap-1.5 text-xs md:text-sm"><Crown className="w-4 h-4" /><span className="hidden sm:inline">Cấp bậc</span></TabsTrigger>
              <TabsTrigger value="deposits" className="gap-1.5 text-xs md:text-sm"><Wallet className="w-4 h-4" /><span className="hidden sm:inline">Nạp tiền</span></TabsTrigger>
              <TabsTrigger value="announcements" className="gap-1.5 text-xs md:text-sm"><Megaphone className="w-4 h-4" /><span className="hidden sm:inline">Thông báo</span></TabsTrigger>
            </TabsList>
          </div>

          {/* Movies Tab */}
          <TabsContent value="movies" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild><Button className="btn-primary gap-2"><Plus className="w-4 h-4" />Thêm phim</Button></DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingMovie ? 'Sửa phim' : 'Thêm phim mới'}</DialogTitle></DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Tiêu đề *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required /></div>
                      <div className="space-y-2"><Label>Năm phát hành</Label><Input type="number" value={form.release_year} onChange={e => setForm(p => ({ ...p, release_year: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>Mô tả</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>Thời lượng (phút)</Label><Input type="number" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Điểm IMDb</Label><Input type="number" step="0.1" max="10" value={form.imdb_rating} onChange={e => setForm(p => ({ ...p, imdb_rating: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Đạo diễn</Label><Input value={form.director} onChange={e => setForm(p => ({ ...p, director: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>Diễn viên (cách nhau dấu phẩy)</Label><Input value={form.actors} onChange={e => setForm(p => ({ ...p, actors: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Thể loại</Label><div className="flex flex-wrap gap-2">{GENRES.map(g => (<button key={g} type="button" onClick={() => setForm(p => ({ ...p, genre: p.genre.includes(g) ? p.genre.filter(x => x !== g) : [...p.genre, g] }))} className={`px-3 py-1 rounded-full text-sm transition ${form.genre.includes(g) ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}>{g}</button>))}</div></div>
                    
                    {/* Payment Section */}
                    <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.requires_payment} onChange={e => setForm(p => ({ ...p, requires_payment: e.target.checked }))} className="rounded" />
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="font-medium">Yêu cầu thanh toán</span>
                        </label>
                      </div>
                      {form.requires_payment && (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Số tiền (VNĐ)</Label>
                            <Input type="number" value={form.payment_amount} onChange={e => setForm(p => ({ ...p, payment_amount: e.target.value }))} placeholder="50000" />
                          </div>
                          <div className="space-y-2">
                            <Label>Ảnh QR thanh toán</Label>
                            <Input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'posters', 'payment', 'payment_image_url')} disabled={uploading} />
                            {uploading && uploadType === 'payment' && <Progress value={uploadProgress} className="h-2" />}
                            {form.payment_image_url && <img src={form.payment_image_url} className="w-24 h-24 object-cover rounded border" />}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Episode Toggle */}
                    <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.has_episodes} onChange={e => setForm(p => ({ ...p, has_episodes: e.target.checked, video_url: e.target.checked ? '' : p.video_url }))} className="rounded" />
                          <Layers className="w-4 h-4" />
                          <span className="font-medium">Có nhiều tập</span>
                        </label>
                      </div>
                      {form.has_episodes && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Số tập</Label>
                            <Input type="number" min="1" value={form.episode_count} onChange={e => setForm(p => ({ ...p, episode_count: e.target.value }))} placeholder="Ví dụ: 12" />
                          </div>
                          {editingMovie ? (
                            <div className="space-y-2">
                              <EpisodeManager movieId={editingMovie.id} episodeCount={parseInt(form.episode_count) || 0} />
                              <p className="text-xs text-muted-foreground">
                                Bấm nút trên để quản lý và tải video cho từng tập
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Sau khi thêm phim, bạn có thể vào chỉnh sửa để upload video cho từng tập
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Poster</Label>
                        <Input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'posters', 'poster', 'poster_url')} disabled={uploading} />
                        {uploading && uploadType === 'poster' && <Progress value={uploadProgress} className="h-2" />}
                        {form.poster_url && <img src={form.poster_url} className="w-20 h-30 object-cover rounded" />}
                      </div>
                      {!form.has_episodes && (
                        <div className="space-y-2">
                          <Label>Video (tối đa 3GB)</Label>
                          <div className="flex gap-2">
                            <Input type="file" accept="video/*" onChange={e => handleFileUpload(e, 'videos', 'video', 'video_url', 'video_filename')} disabled={uploading} className="flex-1" />
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              onClick={() => {
                                setVideoStorageSelectType('video');
                                setVideoStorageDialogOpen(true);
                              }}
                              disabled={uploading}
                              title="Chọn từ kho"
                            >
                              <FolderOpen className="w-4 h-4" />
                            </Button>
                          </div>
                          {uploading && uploadType === 'video' && (
                            <div className="space-y-2 p-3 rounded bg-secondary/50 border">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Đang tải video...</span>
                                <Button variant="ghost" size="sm" onClick={cancelUpload} className="h-7 text-destructive"><X className="w-4 h-4" /></Button>
                              </div>
                              <Progress value={uploadProgress} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{formatFileSize(uploadedFileSize)} / {formatFileSize(totalFileSize)}</span>
                                <span>{uploadProgress}%</span>
                              </div>
                            </div>
                          )}
                          {form.video_url && !uploading && (
                            <div className="flex items-center gap-2 text-xs text-green-500">
                              <Film className="w-4 h-4" />
                              <span className="truncate max-w-[200px]" title={form.video_filename || 'Video đã tải'}>
                                {form.video_filename || 'Video đã tải'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Ad Section */}
                    <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.ad_enabled} onChange={e => setForm(p => ({ ...p, ad_enabled: e.target.checked }))} className="rounded" />
                          <Megaphone className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium">Bật quảng cáo</span>
                        </label>
                      </div>
                      
                      {form.ad_enabled && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Video quảng cáo</Label>
                            <div className="flex gap-2">
                              <Input type="file" accept="video/*" onChange={e => handleFileUpload(e, 'videos', 'ad', 'ad_video_url', 'ad_video_filename')} disabled={uploading} className="flex-1" />
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="icon"
                                onClick={() => {
                                  setVideoStorageSelectType('ad');
                                  setVideoStorageDialogOpen(true);
                                }}
                                disabled={uploading}
                                title="Chọn từ kho"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </Button>
                            </div>
                            {uploading && uploadType === 'ad' && <Progress value={uploadProgress} className="h-2" />}
                            {form.ad_video_url && !uploading && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Film className="w-4 h-4" />
                                <span className="truncate max-w-[200px]" title={form.ad_video_filename || 'Video QC đã tải'}>
                                  {form.ad_video_filename || 'Video QC đã tải'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={form.ad_show_on_load} 
                                onChange={e => setForm(p => ({ ...p, ad_show_on_load: e.target.checked }))} 
                                className="rounded" 
                              />
                              <span className="text-sm">Hiển thị quảng cáo khi vào phim (load trang)</span>
                            </label>
                            <p className="text-xs text-muted-foreground ml-6">
                              Nếu bật, quảng cáo sẽ hiện ngay khi người dùng vào trang xem phim
                            </p>
                          </div>
                          
                          {!form.ad_show_on_load && (
                            <div className="space-y-2">
                              <Label>Vị trí quảng cáo (Giờ : Phút : Giây)</Label>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="number" 
                                  min="0"
                                  placeholder="0" 
                                  value={form.ad_position_hours} 
                                  onChange={e => setForm(p => ({ ...p, ad_position_hours: e.target.value }))}
                                  className="w-20"
                                />
                                <span>:</span>
                                <Input 
                                  type="number" 
                                  min="0"
                                  max="59"
                                  placeholder="0" 
                                  value={form.ad_position_minutes} 
                                  onChange={e => setForm(p => ({ ...p, ad_position_minutes: e.target.value }))}
                                  className="w-20"
                                />
                                <span>:</span>
                                <Input 
                                  type="number" 
                                  min="0"
                                  max="59"
                                  placeholder="0" 
                                  value={form.ad_position_seconds} 
                                  onChange={e => setForm(p => ({ ...p, ad_position_seconds: e.target.value }))}
                                  className="w-20"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Để trống hoặc 0:0:0 để hiển thị quảng cáo ở đầu video
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Intro Skip Section */}
                    <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <SkipForward className="w-4 h-4" />
                        Bỏ qua giới thiệu
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bắt đầu (giây)</Label>
                          <Input 
                            type="number" 
                            value={form.intro_start_seconds} 
                            onChange={e => setForm(p => ({ ...p, intro_start_seconds: e.target.value }))} 
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Kết thúc (giây)</Label>
                          <Input 
                            type="number" 
                            value={form.intro_end_seconds} 
                            onChange={e => setForm(p => ({ ...p, intro_end_seconds: e.target.value }))} 
                            placeholder="30"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Nút "Bỏ qua giới thiệu" sẽ hiển thị khi video chạy từ giây {form.intro_start_seconds || '0'} đến giây {form.intro_end_seconds || '0'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))} className="rounded" /><span>Phim nổi bật</span></label>
                      {form.is_featured && <div className="flex items-center gap-2"><Label className="text-sm">Thứ tự:</Label><Input type="number" value={form.display_order} onChange={e => setForm(p => ({ ...p, display_order: e.target.value }))} className="w-20 h-8" /></div>}
                    </div>
                    <Button type="submit" className="w-full btn-primary">{editingMovie ? 'Cập nhật' : 'Thêm phim'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {movies.map(movie => (
              <div key={movie.id} className="glass-card p-3 md:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {movie.poster_url ? <img src={movie.poster_url} className="w-12 h-18 md:w-16 md:h-24 object-cover rounded shrink-0" /> : <div className="w-12 h-18 md:w-16 md:h-24 bg-secondary rounded flex items-center justify-center shrink-0"><Film className="w-5 h-5 text-muted-foreground" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold truncate text-sm md:text-base">{movie.title}</h3>
                        {(movie as any).requires_payment && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-500 text-[10px] md:text-xs rounded-full">₫{(movie as any).payment_amount?.toLocaleString()}</span>}
                        {(movie as any).has_episodes && <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] md:text-xs rounded-full flex items-center gap-0.5"><Layers className="w-3 h-3" />{(movie as any).episode_count} tập</span>}
                        {(movie as any).ad_video_url && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-600 text-[10px] md:text-xs rounded-full flex items-center gap-0.5"><Megaphone className="w-3 h-3" />QC</span>}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground">{movie.release_year} • {movie.genre?.slice(0, 2).join(', ')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 self-end sm:self-center">
                    {(movie as any).has_episodes && (movie as any).episode_count > 0 && (
                      <EpisodeManager movieId={movie.id} episodeCount={(movie as any).episode_count || 0} />
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(movie)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deleteMovie(movie.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
              {movies.length === 0 && <div className="text-center py-12 text-muted-foreground">Chưa có phim nào</div>}
            </div>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage" className="space-y-4">
            <VideoStorage />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users"><UserManagementTab /></TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments"><PaymentManagementTab /></TabsContent>

          {/* Complaints Tab */}
          <TabsContent value="complaints"><ComplaintManagementTab /></TabsContent>

          {/* Device Management Tab */}
          <TabsContent value="devices">
            <DeviceManagement />
          </TabsContent>

          {/* Tiers Tab */}
          <TabsContent value="tiers">
            <AdminTiers />
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits">
            <AdminDeposits />
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <AdminAnnouncements />
          </TabsContent>
        </Tabs>

        {/* Video Storage Dialog for selecting videos */}
        <VideoStorageDialog
          open={videoStorageDialogOpen}
          onOpenChange={setVideoStorageDialogOpen}
          selectMode={true}
          onSelectVideo={(url, filename) => {
            if (videoStorageSelectType === 'video') {
              setForm(prev => ({ ...prev, video_url: url, video_filename: filename }));
            } else {
              setForm(prev => ({ ...prev, ad_video_url: url, ad_video_filename: filename }));
            }
          }}
        />
      </div>
    </div>
  );
}

// User Management Component
function UserManagementTab() {
  const { users, blockedDevices, blockedIps, isLoading, blockDevice, unblockDevice, blockIp, unblockIp, deleteUser, blockUserCompletely, refresh } = useUserManagement();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [manualBlockDialog, setManualBlockDialog] = useState<'device' | 'ip' | null>(null);
  const [manualValue, setManualValue] = useState('');

  const handleBlockUser = async (userId: string, fingerprint?: string, ip?: unknown) => {
    await blockUserCompletely(userId, fingerprint, ip as string | null, blockReason);
    setSelectedUser(null);
    setBlockReason('');
  };

  // Find user being deleted to get their devices
  const userToDelete = users.find(u => u.id === confirmDelete);

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    
    // Block all devices of the user with the deletion reason before deleting
    if (userToDelete?.devices) {
      for (const device of userToDelete.devices) {
        await blockDevice(device.fingerprint, device.ip_address as string | null, deleteReason || 'Tài khoản đã bị xóa bởi admin');
      }
    }
    
    await deleteUser(confirmDelete);
    setConfirmDelete(null);
    setDeleteReason('');
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setManualBlockDialog('device')}><Ban className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Chặn </span>Fingerprint</Button>
        <Button variant="outline" size="sm" onClick={() => setManualBlockDialog('ip')}><Shield className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Chặn </span>IP</Button>
        <Button variant="ghost" size="sm" onClick={refresh}>Làm mới</Button>
      </div>

      {/* Manual Block Dialogs */}
      <Dialog open={manualBlockDialog !== null} onOpenChange={() => { setManualBlockDialog(null); setManualValue(''); setBlockReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chặn {manualBlockDialog === 'device' ? 'Fingerprint' : 'IP'} thủ công</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{manualBlockDialog === 'device' ? 'Fingerprint' : 'Địa chỉ IP'}</Label>
              <Input value={manualValue} onChange={e => setManualValue(e.target.value)} placeholder={manualBlockDialog === 'device' ? 'abc123...' : '192.168.1.1'} />
            </div>
            <div className="space-y-2">
              <Label>Lý do</Label>
              <Input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Vi phạm quy định..." />
            </div>
            <Button onClick={async () => {
              if (manualBlockDialog === 'device') await blockDevice(manualValue, null, blockReason);
              else await blockIp(manualValue, blockReason);
              setManualBlockDialog(null);
              setManualValue('');
              setBlockReason('');
            }} disabled={!manualValue}>Chặn</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users List */}
      <div className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5" />Người dùng ({users.length})</h3>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
        ) : (
          <div className="grid gap-3">
            {users.map(u => (
              <div key={u.id} className="glass-card p-3 md:p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">{u.email}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{u.full_name || 'Chưa có tên'} • {new Date(u.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {u.devices.length > 0 && (
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedUser(u)}><Ban className="w-3.5 h-3.5 mr-1" />Chặn</Button>
                    )}
                    <Button variant="destructive" size="sm" className="h-8" onClick={() => setConfirmDelete(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                {u.devices.length > 0 && (
                  <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    <p>Thiết bị: {u.devices.length}</p>
                    {u.devices.slice(0, 2).map((d, i) => (
                      <p key={i} className="truncate">• FP: {d.fingerprint.slice(0, 12)}... | IP: {d.ip_address ? String(d.ip_address) : 'N/A'}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked Devices */}
      <div className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-red-500" />Thiết bị bị chặn ({blockedDevices.length})</h3>
        <div className="grid gap-2">
          {blockedDevices.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs md:text-sm truncate">{d.fingerprint.slice(0, 20)}...</p>
                <p className="text-xs text-muted-foreground truncate">{d.reason || 'Không có lý do'} • {new Date(d.created_at).toLocaleDateString('vi-VN')}</p>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => unblockDevice(d.id)}><Unlock className="w-4 h-4" /></Button>
            </div>
          ))}
          {blockedDevices.length === 0 && <p className="text-sm text-muted-foreground">Chưa có thiết bị nào bị chặn</p>}
        </div>
      </div>

      {/* Blocked IPs */}
      <div className="space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-orange-500" />IP bị chặn ({blockedIps.length})</h3>
        <div className="grid gap-2">
          {blockedIps.map(ip => (
            <div key={ip.id} className="flex items-center justify-between gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs md:text-sm truncate">{String(ip.ip_address)}</p>
                <p className="text-xs text-muted-foreground truncate">{ip.reason || 'Không có lý do'}</p>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => unblockIp(ip.id)}><Unlock className="w-4 h-4" /></Button>
            </div>
          ))}
          {blockedIps.length === 0 && <p className="text-sm text-muted-foreground">Chưa có IP nào bị chặn</p>}
        </div>
      </div>

      {/* Block User Dialog */}
      <Dialog open={selectedUser !== null} onOpenChange={() => { setSelectedUser(null); setBlockReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chặn người dùng</DialogTitle><DialogDescription>Chọn thiết bị/IP để chặn</DialogDescription></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <div className="space-y-2">
                <Label>Lý do chặn</Label>
                <Input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Vi phạm quy định..." />
              </div>
              <div className="space-y-2">
                {selectedUser.devices.map((d: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <p className="text-sm font-mono">FP: {d.fingerprint.slice(0, 20)}...</p>
                    <p className="text-sm">IP: {d.ip_address || 'N/A'}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive" onClick={() => handleBlockUser(selectedUser.id, d.fingerprint, d.ip_address)}>Chặn cả hai</Button>
                      <Button size="sm" variant="outline" onClick={() => blockDevice(d.fingerprint, d.ip_address, blockReason)}>Chỉ Fingerprint</Button>
                      {d.ip_address && <Button size="sm" variant="outline" onClick={() => blockIp(String(d.ip_address), blockReason)}>Chỉ IP</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete with Reason */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={() => { setConfirmDelete(null); setDeleteReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa người dùng vĩnh viễn?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Hành động này không thể hoàn tác. Tất cả dữ liệu của người dùng sẽ bị xóa và thiết bị của họ sẽ bị chặn.</p>
              <div className="space-y-2">
                <Label>Lý do xóa (sẽ hiển thị cho người dùng)</Label>
                <Input 
                  value={deleteReason} 
                  onChange={e => setDeleteReason(e.target.value)} 
                  placeholder="Vi phạm điều khoản sử dụng..."
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Payment Management Component
function PaymentManagementTab() {
  const { allPayments, isLoading, updatePaymentStatus, fetchAllPayments } = useAdminPayments();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');

  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  const processedPayments = allPayments.filter(p => p.status !== 'pending');

  const handleApprove = async (id: string) => {
    await updatePaymentStatus(id, 'approved', adminNote);
    setSelectedPayment(null);
    setAdminNote('');
  };

  const handleReject = async (id: string) => {
    await updatePaymentStatus(id, 'rejected', adminNote);
    setSelectedPayment(null);
    setAdminNote('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Yêu cầu thanh toán chờ duyệt ({pendingPayments.length})</h3>
        <Button variant="ghost" onClick={fetchAllPayments}>Làm mới</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          {/* Pending Payments */}
          <div className="grid gap-4">
            {pendingPayments.map(p => (
              <div key={p.id} className="glass-card p-3 md:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm md:text-base truncate">{(p.movies as any)?.title || 'Phim'}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{(p.profiles as any)?.email}</p>
                    <p className="text-base md:text-lg font-bold text-green-500">₫{p.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="h-8 text-xs" onClick={() => setSelectedPayment(p)}><Image className="w-3.5 h-3.5 mr-1" />Xem</Button>
                    <Button size="sm" className="h-8" variant="default" onClick={() => handleApprove(p.id)}><Check className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" className="h-8" variant="destructive" onClick={() => handleReject(p.id)}><XCircle className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
            {pendingPayments.length === 0 && <p className="text-center text-muted-foreground py-8">Không có yêu cầu nào chờ duyệt</p>}
          </div>

          {/* Processed Payments */}
          <div className="space-y-2">
            <h3 className="font-semibold">Đã xử lý ({processedPayments.length})</h3>
            <div className="grid gap-2">
              {processedPayments.slice(0, 10).map(p => (
                <div key={p.id} className={`p-3 rounded-lg border ${p.status === 'approved' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{(p.movies as any)?.title}</p>
                      <p className="text-sm text-muted-foreground">{(p.profiles as any)?.email} • ₫{p.amount.toLocaleString()}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${p.status === 'approved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {p.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* View Payment Dialog */}
      <Dialog open={selectedPayment !== null} onOpenChange={() => { setSelectedPayment(null); setAdminNote(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chi tiết thanh toán</DialogTitle></DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Phim:</span><p className="font-medium">{(selectedPayment.movies as any)?.title}</p></div>
                <div><span className="text-muted-foreground">Số tiền:</span><p className="font-medium text-green-500">₫{selectedPayment.amount.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Người dùng:</span><p className="font-medium">{(selectedPayment.profiles as any)?.email}</p></div>
                <div><span className="text-muted-foreground">Thời gian:</span><p className="font-medium">{new Date(selectedPayment.created_at).toLocaleString('vi-VN')}</p></div>
              </div>
              <div>
                <Label>Ảnh xác nhận thanh toán</Label>
                <img src={selectedPayment.proof_image_url} alt="Payment proof" className="w-full max-h-64 object-contain rounded-lg border mt-2" />
              </div>
              <div className="space-y-2">
                <Label>Ghi chú admin</Label>
                <Input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Ghi chú (tùy chọn)..." />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleApprove(selectedPayment.id)}><Check className="w-4 h-4 mr-2" />Duyệt</Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleReject(selectedPayment.id)}><XCircle className="w-4 h-4 mr-2" />Từ chối</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Complaint Management Component
function ComplaintManagementTab() {
  const { complaints, isLoading, updateComplaintStatus, fetchComplaints } = useAdminComplaints();
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const { toast } = useToast();

  const pendingComplaints = complaints.filter(c => c.status === 'pending');
  const processedComplaints = complaints.filter(c => c.status !== 'pending');

  const handleResolve = async (id: string) => {
    const success = await updateComplaintStatus(id, 'resolved', adminResponse);
    if (success) {
      toast({ title: 'Đã giải quyết khiếu nại' });
      setSelectedComplaint(null);
      setAdminResponse('');
    }
  };

  const handleReject = async (id: string) => {
    const success = await updateComplaintStatus(id, 'rejected', adminResponse);
    if (success) {
      toast({ title: 'Đã từ chối khiếu nại' });
      setSelectedComplaint(null);
      setAdminResponse('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Khiếu nại chờ xử lý ({pendingComplaints.length})</h3>
        <Button variant="ghost" onClick={fetchComplaints}>Làm mới</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          {/* Pending Complaints */}
          <div className="grid gap-4">
            {pendingComplaints.map(c => (
              <div key={c.id} className="glass-card p-3 md:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm md:text-base truncate">{(c.payment_requests as any)?.movies?.title || 'Phim'}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{(c.profiles as any)?.email}</p>
                    <p className="text-xs md:text-sm mt-1"><strong>Lý do:</strong> {c.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="h-8 text-xs" onClick={() => setSelectedComplaint(c)}>Xem</Button>
                    <Button size="sm" className="h-8" variant="default" onClick={() => handleResolve(c.id)}><Check className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" className="h-8" variant="destructive" onClick={() => handleReject(c.id)}><XCircle className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
            {pendingComplaints.length === 0 && <p className="text-center text-muted-foreground py-8">Không có khiếu nại nào chờ xử lý</p>}
          </div>

          {/* Processed Complaints */}
          <div className="space-y-2">
            <h3 className="font-semibold">Đã xử lý ({processedComplaints.length})</h3>
            <div className="grid gap-2">
              {processedComplaints.slice(0, 10).map(c => (
                <div key={c.id} className={`p-3 rounded-lg border ${c.status === 'resolved' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{(c.payment_requests as any)?.movies?.title}</p>
                      <p className="text-sm text-muted-foreground">{(c.profiles as any)?.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.reason.slice(0, 50)}...</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${c.status === 'resolved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {c.status === 'resolved' ? 'Đã giải quyết' : 'Từ chối'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* View Complaint Dialog */}
      <Dialog open={selectedComplaint !== null} onOpenChange={() => { setSelectedComplaint(null); setAdminResponse(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chi tiết khiếu nại</DialogTitle></DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Phim:</span><p className="font-medium">{(selectedComplaint.payment_requests as any)?.movies?.title}</p></div>
                <div><span className="text-muted-foreground">Số tiền:</span><p className="font-medium text-green-500">₫{(selectedComplaint.payment_requests as any)?.amount?.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Người dùng:</span><p className="font-medium">{(selectedComplaint.profiles as any)?.email}</p></div>
                <div><span className="text-muted-foreground">Thời gian:</span><p className="font-medium">{new Date(selectedComplaint.created_at).toLocaleString('vi-VN')}</p></div>
              </div>
              <div>
                <Label>Lý do khiếu nại</Label>
                <p className="p-3 bg-secondary/50 rounded-lg mt-1">{selectedComplaint.reason}</p>
              </div>
              {selectedComplaint.image_url && (
                <div>
                  <Label>Ảnh minh họa</Label>
                  <img src={selectedComplaint.image_url} alt="Complaint" className="w-full max-h-64 object-contain rounded-lg border mt-2" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Phản hồi admin</Label>
                <Textarea value={adminResponse} onChange={e => setAdminResponse(e.target.value)} placeholder="Phản hồi cho người dùng..." rows={3} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleResolve(selectedComplaint.id)}><Check className="w-4 h-4 mr-2" />Giải quyết</Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleReject(selectedComplaint.id)}><XCircle className="w-4 h-4 mr-2" />Từ chối</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
