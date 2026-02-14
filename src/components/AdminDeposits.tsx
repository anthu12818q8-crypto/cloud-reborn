import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminDeposits } from '@/hooks/useDeposit';
import { Check, XCircle, Image as ImageIcon, Clock } from 'lucide-react';

export function AdminDeposits() {
  const { allDeposits, isLoading, approveDeposit, rejectDeposit, fetchAllDeposits } = useAdminDeposits();
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');

  const pendingDeposits = allDeposits.filter(d => d.status === 'pending');
  const processedDeposits = allDeposits.filter(d => d.status !== 'pending');

  const handleApprove = async (id: string) => {
    await approveDeposit(id, adminNote);
    setSelectedDeposit(null);
    setAdminNote('');
  };

  const handleReject = async (id: string) => {
    await rejectDeposit(id, adminNote);
    setSelectedDeposit(null);
    setAdminNote('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Yêu cầu nạp tiền chờ duyệt ({pendingDeposits.length})</h3>
        <Button variant="ghost" onClick={fetchAllDeposits}>Làm mới</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          <div className="grid gap-4">
            {pendingDeposits.map(d => (
              <div key={d.id} className="glass-card p-3 md:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm md:text-base text-muted-foreground truncate">
                      {(d.profiles as any)?.email || 'N/A'}
                    </p>
                    <p className="text-lg md:text-xl font-bold text-emerald-500">
                      {d.amount.toLocaleString('vi-VN')}₫
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(d.created_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="h-8 text-xs" onClick={() => setSelectedDeposit(d)}>
                      <ImageIcon className="w-3.5 h-3.5 mr-1" />Xem
                    </Button>
                    <Button size="sm" className="h-8" onClick={() => handleApprove(d.id)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" className="h-8" variant="destructive" onClick={() => handleReject(d.id)}>
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {pendingDeposits.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Không có yêu cầu nào chờ duyệt</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Đã xử lý ({processedDeposits.length})</h3>
            <div className="grid gap-2">
              {processedDeposits.slice(0, 20).map(d => (
                <div key={d.id} className={`p-3 rounded-lg border ${
                  d.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">{(d.profiles as any)?.email}</p>
                      <p className="font-medium">{d.amount.toLocaleString('vi-VN')}₫</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs text-white ${
                      d.status === 'approved' ? 'bg-emerald-500' : 'bg-destructive'
                    }`}>
                      {d.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={selectedDeposit !== null} onOpenChange={() => { setSelectedDeposit(null); setAdminNote(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chi tiết yêu cầu nạp tiền</DialogTitle></DialogHeader>
          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Người dùng:</span>
                  <p className="font-medium">{(selectedDeposit.profiles as any)?.email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Số tiền:</span>
                  <p className="font-medium text-emerald-500">{selectedDeposit.amount.toLocaleString('vi-VN')}₫</p>
                </div>
              </div>
              <div>
                <Label>Ảnh xác nhận</Label>
                <img src={selectedDeposit.proof_image_url} alt="Proof" className="w-full max-h-64 object-contain rounded-lg border mt-2" />
              </div>
              <div className="space-y-2">
                <Label>Ghi chú admin</Label>
                <Input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Ghi chú (tùy chọn)..." />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleApprove(selectedDeposit.id)}>
                  <Check className="w-4 h-4 mr-2" />Duyệt
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleReject(selectedDeposit.id)}>
                  <XCircle className="w-4 h-4 mr-2" />Từ chối
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
