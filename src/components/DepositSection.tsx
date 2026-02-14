import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TierBadge } from '@/components/TierBadge';
import { useTier } from '@/hooks/useTier';
import { useDeposit } from '@/hooks/useDeposit';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Upload, Clock, Check, XCircle, ArrowUp, Image as ImageIcon } from 'lucide-react';

export function DepositSection() {
  const { tiers, userInfo } = useTier();
  const { myDeposits, isLoading, submitDeposit } = useDeposit();
  const [showDialog, setShowDialog] = useState(false);
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchQr = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings' as any)
          .select('value')
          .eq('key', 'payment_qr_url')
          .maybeSingle();
        if (data) setPaymentQrUrl((data as any).value || '');
      } catch { /* */ }
    };
    fetchQr();
  }, []);

  const nextTier = tiers.find(t => t.min_amount > userInfo.totalDeposited);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!amount || !proofFile) return;
    setSubmitting(true);
    const success = await submitDeposit(parseFloat(amount), proofFile);
    if (success) {
      setShowDialog(false);
      setAmount('');
      setProofFile(null);
      setProofPreview(null);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg sm:text-xl flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        Tài khoản & Thanh toán
      </h2>

      {/* Balance & Tier Card */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Số dư tài khoản</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-500">
              {userInfo.balance.toLocaleString('vi-VN')}₫
            </p>
          </div>
          {userInfo.tier && (
            <TierBadge
              tierKey={userInfo.tier.tier_key}
              displayName={userInfo.tier.display_name}
              icon={userInfo.tier.icon}
              size="lg"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-muted-foreground text-xs">Tổng đã nạp</p>
            <p className="font-semibold">{userInfo.totalDeposited.toLocaleString('vi-VN')}₫</p>
          </div>
          {nextTier && (
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-muted-foreground text-xs">Cấp tiếp theo</p>
              <p className="font-semibold flex items-center gap-1">
                {nextTier.icon} {nextTier.display_name}
              </p>
              <p className="text-xs text-muted-foreground">
                Cần thêm {(nextTier.min_amount - userInfo.totalDeposited).toLocaleString('vi-VN')}₫
              </p>
            </div>
          )}
        </div>

        <Button onClick={() => setShowDialog(true)} className="w-full gap-2 btn-primary">
          <ArrowUp className="w-4 h-4" />
          Nạp tiền
        </Button>
      </div>

      {/* Tier Progression */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="font-semibold text-sm">Bậc thành viên</h3>
        <div className="space-y-2">
          {tiers.map(tier => {
            const isActive = userInfo.tier?.tier_key === tier.tier_key;
            const isAchieved = userInfo.totalDeposited >= tier.min_amount;
            return (
              <div key={tier.id} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${isActive ? 'border-primary bg-primary/10' : isAchieved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-secondary/30'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tier.icon}</span>
                  <span className={`font-medium text-sm ${isActive ? 'text-primary' : ''}`}>{tier.display_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{tier.min_amount.toLocaleString('vi-VN')}₫</span>
                  {isAchieved && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Deposits */}
      {myDeposits.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Lịch sử nạp tiền</h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {myDeposits.slice(0, 10).map(d => (
              <div key={d.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                d.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20' :
                d.status === 'rejected' ? 'bg-destructive/10 border-destructive/20' :
                'bg-secondary/30'
              }`}>
                <div>
                  <p className="font-medium text-sm">{d.amount.toLocaleString('vi-VN')}₫</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  d.status === 'approved' ? 'bg-emerald-500 text-white' :
                  d.status === 'rejected' ? 'bg-destructive text-white' :
                  'bg-yellow-500 text-white'
                }`}>
                  {d.status === 'approved' ? <><Check className="w-3 h-3" /> Đã duyệt</> :
                   d.status === 'rejected' ? <><XCircle className="w-3 h-3" /> Từ chối</> :
                   <><Clock className="w-3 h-3" /> Chờ duyệt</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deposit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Nạp tiền vào tài khoản
            </DialogTitle>
            <DialogDescription>
              Chuyển khoản theo thông tin bên dưới và tải ảnh xác nhận
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số tiền nạp (VNĐ)</Label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Nhập số tiền..."
                min="1000"
              />
            </div>

            {paymentQrUrl && (
              <div className="space-y-2">
                <Label>Quét mã QR để chuyển khoản</Label>
                <div className="border rounded-lg p-2 bg-white">
                  <img src={paymentQrUrl} alt="Payment QR" className="w-full max-h-48 object-contain" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Ảnh xác nhận chuyển khoản (bill)</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {proofPreview ? (
                  <div className="space-y-2">
                    <img src={proofPreview} alt="Proof" className="w-24 h-24 mx-auto object-cover rounded" />
                    <p className="text-sm text-emerald-500 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> Đã chọn ảnh
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nhấn để tải ảnh bill từ thiết bị</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!amount || !proofFile || submitting}
            >
              {submitting ? 'Đang gửi...' : 'Gửi yêu cầu nạp tiền'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
