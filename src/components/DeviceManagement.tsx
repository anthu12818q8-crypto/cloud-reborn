import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldOff, Unlock, Clock, Smartphone, Wifi, RefreshCw, Search, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface LockedDevice {
  id: string;
  fingerprint: string;
  ip_address: unknown;
  attempt_count: number;
  lock_level: number | null;
  blocked_until: string | null;
  last_attempt_at: string;
  total_violations: number | null;
  attempt_type: string;
}

interface BlockedDevice {
  id: string;
  fingerprint: string;
  ip_address: unknown;
  reason: string | null;
  created_at: string;
  blocked_by: string | null;
}

interface BlockedIP {
  id: string;
  ip_address: unknown;
  reason: string | null;
  created_at: string;
  blocked_by: string | null;
}

export function DeviceManagement() {
  const { toast } = useToast();
  const [lockedDevices, setLockedDevices] = useState<LockedDevice[]>([]);
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'locked' | 'blocked' | 'ip'; id: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'locked' | 'blocked' | 'ips'>('locked');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch temporarily locked devices (from login_attempts)
      const { data: locked, error: lockedError } = await supabase
        .from('login_attempts')
        .select('*')
        .or('blocked_until.gt.now(),lock_level.gt.0')
        .order('last_attempt_at', { ascending: false });

      if (lockedError) throw lockedError;
      setLockedDevices(locked || []);

      // Fetch permanently blocked devices
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (blockedError) throw blockedError;
      setBlockedDevices(blocked || []);

      // Fetch blocked IPs
      const { data: ips, error: ipsError } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('created_at', { ascending: false });

      if (ipsError) throw ipsError;
      setBlockedIPs(ips || []);
    } catch (error: any) {
      toast({
        title: 'Lỗi tải dữ liệu',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const formatRemainingTime = (blockedUntil: string | null) => {
    if (!blockedUntil) return 'Không xác định';
    const remaining = new Date(blockedUntil).getTime() - Date.now();
    if (remaining <= 0) return 'Đã hết hạn';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}p`;
    return `${minutes} phút`;
  };

  const getLockLevelBadge = (level: number) => {
    switch (level) {
      case 1:
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">Cấp 1 (15 phút)</Badge>;
      case 2:
        return <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">Cấp 2 (30 phút)</Badge>;
      case 3:
        return <Badge variant="destructive">Cấp 3 (24 giờ)</Badge>;
      default:
        return <Badge variant="outline">Không khoá</Badge>;
    }
  };

  const handleUnlock = async (device: LockedDevice) => {
    setUnlockingId(device.id);
    try {
      const { error } = await supabase
        .from('login_attempts')
        .delete()
        .eq('id', device.id);

      if (error) throw error;

      toast({
        title: 'Đã mở khoá',
        description: `Thiết bị ${device.fingerprint.substring(0, 8)}... đã được mở khoá`,
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Lỗi mở khoá',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUnlockingId(null);
    }
  };

  const handleRemoveBlockedDevice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('blocked_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Đã xoá',
        description: 'Thiết bị đã được xoá khỏi danh sách chặn vĩnh viễn',
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Lỗi xoá',
        description: error.message,
        variant: 'destructive',
      });
    }
    setDeleteConfirm(null);
  };

  const handleRemoveBlockedIP = async (id: string) => {
    try {
      const { error } = await supabase
        .from('blocked_ips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Đã xoá',
        description: 'IP đã được xoá khỏi danh sách chặn',
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Lỗi xoá',
        description: error.message,
        variant: 'destructive',
      });
    }
    setDeleteConfirm(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;
    
    switch (deleteConfirm.type) {
      case 'locked':
        handleUnlock(lockedDevices.find(d => d.id === deleteConfirm.id)!);
        break;
      case 'blocked':
        handleRemoveBlockedDevice(deleteConfirm.id);
        break;
      case 'ip':
        handleRemoveBlockedIP(deleteConfirm.id);
        break;
    }
  };

  const formatIpAddress = (ip: unknown): string => {
    if (ip === null || ip === undefined) return '';
    return String(ip);
  };

  const filteredLocked = lockedDevices.filter(d => 
    d.fingerprint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatIpAddress(d.ip_address).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBlocked = blockedDevices.filter(d =>
    d.fingerprint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatIpAddress(d.ip_address).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.reason && d.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredIPs = blockedIPs.filter(ip =>
    formatIpAddress(ip.ip_address).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ip.reason && ip.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveSection('locked')}
          className={`p-4 rounded-lg border transition-all ${
            activeSection === 'locked' 
              ? 'border-primary bg-primary/10' 
              : 'border-border bg-card hover:bg-secondary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold">{lockedDevices.length}</p>
              <p className="text-sm text-muted-foreground">Khoá tạm thời</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setActiveSection('blocked')}
          className={`p-4 rounded-lg border transition-all ${
            activeSection === 'blocked' 
              ? 'border-primary bg-primary/10' 
              : 'border-border bg-card hover:bg-secondary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <ShieldOff className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold">{blockedDevices.length}</p>
              <p className="text-sm text-muted-foreground">Chặn vĩnh viễn</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setActiveSection('ips')}
          className={`p-4 rounded-lg border transition-all ${
            activeSection === 'ips' 
              ? 'border-primary bg-primary/10' 
              : 'border-border bg-card hover:bg-secondary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Wifi className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold">{blockedIPs.length}</p>
              <p className="text-sm text-muted-foreground">IP bị chặn</p>
            </div>
          </div>
        </button>
      </div>

      {/* Search & Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo fingerprint, IP, lý do..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Temporarily Locked Devices */}
      {activeSection === 'locked' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Thiết bị bị khoá tạm thời ({filteredLocked.length})
          </h3>
          
          {filteredLocked.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Không có thiết bị nào đang bị khoá tạm thời</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Số lần sai</TableHead>
                    <TableHead>Mức khoá</TableHead>
                    <TableHead>Thời gian còn</TableHead>
                    <TableHead>Lần cuối</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocked.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                          {device.fingerprint.substring(0, 12)}...
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatIpAddress(device.ip_address) || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {device.attempt_type === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-destructive font-medium">{device.attempt_count}</span>
                        <span className="text-muted-foreground text-xs"> / {device.attempt_type === 'login' ? '5' : '3'}</span>
                      </TableCell>
                      <TableCell>{getLockLevelBadge(device.lock_level || 0)}</TableCell>
                      <TableCell>
                        {device.blocked_until ? (
                          <span className="text-yellow-500 font-medium">
                            {formatRemainingTime(device.blocked_until)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(device.last_attempt_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ type: 'locked', id: device.id })}
                          disabled={unlockingId === device.id}
                          className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        >
                          {unlockingId === device.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Permanently Blocked Devices */}
      {activeSection === 'blocked' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-red-500" />
            Thiết bị bị chặn vĩnh viễn ({filteredBlocked.length})
          </h3>
          
          {filteredBlocked.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Không có thiết bị nào bị chặn vĩnh viễn</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Ngày chặn</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBlocked.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-destructive" />
                          {device.fingerprint.substring(0, 12)}...
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatIpAddress(device.ip_address) || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{device.reason || 'Không có lý do'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(device.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ type: 'blocked', id: device.id })}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Blocked IPs */}
      {activeSection === 'ips' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="w-5 h-5 text-purple-500" />
            IP bị chặn ({filteredIPs.length})
          </h3>
          
          {filteredIPs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wifi className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Không có IP nào bị chặn</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Địa chỉ IP</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Ngày chặn</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIPs.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-muted-foreground" />
                          {formatIpAddress(ip.ip_address)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{ip.reason || 'Không có lý do'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(ip.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm({ type: 'ip', id: ip.id })}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Xác nhận {deleteConfirm?.type === 'locked' ? 'mở khoá' : 'xoá chặn'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'locked' 
                ? 'Thiết bị này sẽ được mở khoá và có thể đăng nhập lại ngay lập tức. Bạn có chắc chắn?'
                : 'Thiết bị/IP này sẽ được xoá khỏi danh sách chặn vĩnh viễn. Bạn có chắc chắn?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {deleteConfirm?.type === 'locked' ? 'Mở khoá' : 'Xoá chặn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
