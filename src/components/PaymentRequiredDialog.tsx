import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Check, Clock, XCircle, Image as ImageIcon, Download, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentRequiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  movie: {
    id: string;
    title: string;
    payment_amount: number | null;
    payment_image_url: string | null;
  };
  userId: string;
  onPaymentSubmitted: () => void;
  existingPayment?: { status: string } | null;
}

export function PaymentRequiredDialog({
  isOpen,
  onClose,
  movie,
  userId,
  onPaymentSubmitted,
  existingPayment,
}: PaymentRequiredDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showQRFullscreen, setShowQRFullscreen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadQR = async () => {
    if (!movie.payment_image_url) return;
    try {
      const response = await fetch(movie.payment_image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${movie.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: 'Đã tải ảnh QR' });
    } catch (error) {
      toast({ title: 'Lỗi tải ảnh', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File quá lớn', description: 'Ảnh không được vượt quá 10MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Bạn cần đăng nhập');

      const ext = file.name.split('.').pop();
      const fileName = `${userId}/${movie.id}/${Date.now()}.${ext}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const url = `${supabaseUrl}/storage/v1/object/public/payment-proofs/${fileName}`;
      setProofUrl(url);
      setUploadProgress(100);
      toast({ title: 'Tải ảnh thành công' });
    } catch (error: any) {
      toast({ title: 'Lỗi tải ảnh', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!proofUrl) {
      toast({ title: 'Vui lòng tải ảnh xác nhận thanh toán', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('payment_requests').insert({
        user_id: userId,
        movie_id: movie.id,
        amount: movie.payment_amount || 0,
        proof_image_url: proofUrl,
      });

      if (error) throw error;

      toast({ title: 'Đã gửi yêu cầu thanh toán', description: 'Admin sẽ xác nhận sớm nhất có thể' });
      onPaymentSubmitted();
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusContent = () => {
    if (existingPayment?.status === 'pending') {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Đang chờ xác nhận</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Yêu cầu thanh toán của bạn đang được admin xem xét. Vui lòng đợi...
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      );
    }

    if (existingPayment?.status === 'rejected') {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Thanh toán bị từ chối</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Yêu cầu thanh toán trước đó đã bị từ chối. Bạn có thể gửi lại.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Yêu cầu thanh toán
          </DialogTitle>
          <DialogDescription>
            Phim "{movie.title}" yêu cầu thanh toán để xem
          </DialogDescription>
        </DialogHeader>

        {getStatusContent()}

        {(!existingPayment || existingPayment.status === 'rejected') && (
          <div className="space-y-4">
            {/* Payment Amount */}
            <div className="p-4 bg-emerald-500/10 rounded-lg text-center border border-emerald-500/20">
              <p className="text-sm text-muted-foreground">Số tiền cần thanh toán</p>
              <p className="text-3xl font-bold text-emerald-500">
                {(movie.payment_amount || 0).toLocaleString('vi-VN')}₫
              </p>
            </div>

            {/* QR Code Image */}
            {movie.payment_image_url && (
              <div className="space-y-2">
                <Label>Quét mã QR để chuyển khoản (Nhấn để xem lớn)</Label>
                <div 
                  className="border rounded-lg p-2 bg-white cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
                  onClick={() => setShowQRFullscreen(true)}
                >
                  <img
                    src={movie.payment_image_url}
                    alt="Payment QR"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Upload Proof */}
            <div className="space-y-2">
              <Label>Ảnh xác nhận chuyển khoản</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {proofUrl ? (
                  <div className="space-y-2">
                    <img src={proofUrl} alt="Proof" className="w-24 h-24 mx-auto object-cover rounded" />
                    <p className="text-sm text-green-500 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> Đã tải ảnh
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Nhấn để tải ảnh xác nhận thanh toán
                    </p>
                  </div>
                )}
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading && <Progress value={uploadProgress} className="h-2" />}
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              onClick={handleSubmitPayment}
              disabled={!proofUrl || submitting}
            >
              {submitting ? 'Đang gửi...' : 'Gửi yêu cầu xác nhận'}
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Fullscreen QR Dialog */}
      {showQRFullscreen && movie.payment_image_url && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setShowQRFullscreen(false)}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadQR();
              }}
            >
              <Download className="w-4 h-4" />
              Tải về
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQRFullscreen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="bg-white rounded-xl p-4 max-w-lg w-full">
            <img
              src={movie.payment_image_url}
              alt="Payment QR Code"
              className="w-full h-auto object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-white/70 text-sm mt-4">Nhấn vào nền hoặc nút X để đóng</p>
        </div>
      )}
    </Dialog>
  );
}
