import { useState } from 'react';
import { Bell, Check, CheckCheck, MessageSquare, CreditCard, X, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [complaintDialog, setComplaintDialog] = useState<{ open: boolean; notification: Notification | null }>({
    open: false,
    notification: null,
  });
  const [complaintReason, setComplaintReason] = useState('');
  const [complaintImage, setComplaintImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (!user) return null;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_approved':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'payment_rejected':
        return <X className="w-4 h-4 text-red-500" />;
      case 'complaint_response':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      default:
        return <CreditCard className="w-4 h-4 text-primary" />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // For payment notifications, open complaint dialog
    if (notification.type === 'payment_approved' || notification.type === 'payment_rejected') {
      setComplaintDialog({ open: true, notification });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File quá lớn', description: 'Ảnh không được vượt quá 10MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage
        .from('complaint-images')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      setComplaintImage(`${supabaseUrl}/storage/v1/object/public/complaint-images/${fileName}`);
      toast({ title: 'Tải ảnh thành công' });
    } catch (error: any) {
      toast({ title: 'Lỗi tải ảnh', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitComplaint = async () => {
    if (!complaintReason.trim()) {
      toast({ title: 'Vui lòng nhập lý do khiếu nại', variant: 'destructive' });
      return;
    }

    if (!complaintDialog.notification?.related_id) {
      toast({ title: 'Không tìm thấy yêu cầu thanh toán', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('payment_complaints').insert({
        payment_request_id: complaintDialog.notification.related_id,
        user_id: user.id,
        reason: complaintReason,
        image_url: complaintImage,
      });

      if (error) throw error;

      toast({ title: 'Đã gửi khiếu nại', description: 'Admin sẽ xem xét sớm nhất' });
      setComplaintDialog({ open: false, notification: null });
      setComplaintReason('');
      setComplaintImage(null);
    } catch (error: any) {
      toast({ title: 'Lỗi gửi khiếu nại', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full glass-button">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 glass-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Thông báo</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7 gap-1">
                <CheckCheck className="w-3 h-3" />
                Đọc tất cả
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Chưa có thông báo</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 cursor-pointer hover:bg-secondary/50 transition-colors ${
                      !notification.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: vi })}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Complaint Dialog */}
      <Dialog open={complaintDialog.open} onOpenChange={(open) => {
        if (!open) {
          setComplaintDialog({ open: false, notification: null });
          setComplaintReason('');
          setComplaintImage(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Khiếu nại thanh toán
            </DialogTitle>
            <DialogDescription>
              Gửi khiếu nại nếu bạn gặp vấn đề với yêu cầu thanh toán
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-sm font-medium">{complaintDialog.notification?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{complaintDialog.notification?.message}</p>
            </div>

            <div className="space-y-2">
              <Label>Lý do khiếu nại *</Label>
              <Textarea
                value={complaintReason}
                onChange={(e) => setComplaintReason(e.target.value)}
                placeholder="Mô tả vấn đề bạn gặp phải..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Ảnh minh họa (tùy chọn)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                  id="complaint-image"
                />
                <label
                  htmlFor="complaint-image"
                  className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="text-sm">{uploading ? 'Đang tải...' : 'Chọn ảnh'}</span>
                </label>
                {complaintImage && (
                  <div className="relative">
                    <img src={complaintImage} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    <button
                      onClick={() => setComplaintImage(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmitComplaint}
              disabled={submitting || !complaintReason.trim()}
            >
              {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
