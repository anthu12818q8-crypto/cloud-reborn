import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TierBadge } from '@/components/TierBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, Image as ImageIcon } from 'lucide-react';
import type { TierSetting } from '@/hooks/useTier';

export function AdminTiers() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<TierSetting[]>([]);
  const [editedTiers, setEditedTiers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [tiersRes, settingsRes] = await Promise.all([
        supabase.from('tier_settings' as any).select('*').order('display_order'),
        supabase.from('admin_settings' as any).select('*').eq('key', 'payment_qr_url').maybeSingle(),
      ]);
      if (tiersRes.data) setTiers(tiersRes.data as any);
      if (settingsRes.data) setPaymentQrUrl((settingsRes.data as any).value || '');
    };
    fetchData();
  }, []);

  const handleSaveTiers = async () => {
    setSaving(true);
    try {
      for (const [tierId, minAmount] of Object.entries(editedTiers)) {
        const { error } = await supabase
          .from('tier_settings' as any)
          .update({ min_amount: minAmount })
          .eq('id', tierId);
        if (error) throw error;
      }
      toast({ title: 'Đã cập nhật cấp bậc' });
      setEditedTiers({});
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `admin/payment_qr_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/storage/v1/object/public/payment-proofs/${fileName}`;

      const { error } = await supabase
        .from('admin_settings' as any)
        .update({ value: url, updated_at: new Date().toISOString() })
        .eq('key', 'payment_qr_url');
      if (error) throw error;

      setPaymentQrUrl(url);
      toast({ title: 'Đã cập nhật ảnh QR thanh toán' });
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingQr(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment QR Setting */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Ảnh QR thanh toán (Nạp tiền)
        </h3>
        <p className="text-sm text-muted-foreground">
          Ảnh QR này sẽ hiển thị cho người dùng khi nạp tiền vào tài khoản
        </p>
        <div className="flex items-start gap-4">
          {paymentQrUrl && (
            <div className="border rounded-lg p-2 bg-white w-32 h-32 flex-shrink-0">
              <img src={paymentQrUrl} alt="QR" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="space-y-2 flex-1">
            <Label>Tải lên ảnh QR mới</Label>
            <Input type="file" accept="image/*" onChange={handleUploadQr} disabled={uploadingQr} />
            {uploadingQr && <p className="text-xs text-muted-foreground">Đang tải...</p>}
          </div>
        </div>
      </div>

      {/* Tier Settings */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <h3 className="font-semibold">Cài đặt cấp bậc thành viên</h3>
        <p className="text-sm text-muted-foreground">
          Điều chỉnh số tiền tối thiểu cần nạp để đạt mỗi cấp
        </p>

        <div className="space-y-3">
          {tiers.map(tier => {
            const currentAmount = editedTiers[tier.id] ?? tier.min_amount;
            return (
              <div key={tier.id} className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/30">
                <TierBadge tierKey={tier.tier_key} displayName={tier.display_name} icon={tier.icon} size="md" />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Số tiền tối thiểu (VNĐ)</Label>
                  <Input
                    type="number"
                    value={currentAmount}
                    onChange={e => setEditedTiers(prev => ({ ...prev, [tier.id]: parseFloat(e.target.value) || 0 }))}
                    className="h-9"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(editedTiers).length > 0 && (
          <Button onClick={handleSaveTiers} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        )}
      </div>
    </div>
  );
}
