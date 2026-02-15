import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  proof_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_id: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { email: string; full_name: string | null };
}

export function useDeposit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myDeposits, setMyDeposits] = useState<DepositRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMyDeposits = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('deposit_requests' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setMyDeposits(data as any);
    } catch { /* table may not exist */ }
  }, [user]);

  useEffect(() => { fetchMyDeposits(); }, [fetchMyDeposits]);

  const submitDeposit = async (amount: number, proofFile: File): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);
    try {
      const ext = proofFile.name.split('.').pop();
      const fileName = `deposits/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile);
      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const proofUrl = `${supabaseUrl}/storage/v1/object/public/payment-proofs/${fileName}`;

      const { error } = await supabase
        .from('deposit_requests' as any)
        .insert({ user_id: user.id, amount, proof_image_url: proofUrl });
      if (error) throw error;

      toast({ title: 'Đã gửi yêu cầu nạp tiền', description: 'Vui lòng chờ admin xác nhận' });
      await fetchMyDeposits();
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi gửi yêu cầu', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { myDeposits, isLoading, submitDeposit, fetchMyDeposits };
}

// Admin hook
export function useAdminDeposits() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [allDeposits, setAllDeposits] = useState<DepositRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllDeposits = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const { data: deposits } = await supabase
        .from('deposit_requests' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!deposits) { setIsLoading(false); return; }

      const userIds = [...new Set((deposits as any[]).map((d: any) => d.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, email, full_name').in('id', userIds)
        : { data: [] };

      const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const enriched = (deposits as any[]).map((d: any) => ({
        ...d,
        profiles: profilesMap.get(d.user_id) || null,
      }));

      setAllDeposits(enriched as any);
    } catch { /* */ } finally { setIsLoading(false); }
  }, [isAdmin]);

  useEffect(() => { fetchAllDeposits(); }, [fetchAllDeposits]);

  const approveDeposit = async (depositId: string, note?: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('approve_deposit' as any, {
        p_deposit_id: depositId,
        p_admin_id: user?.id,
        p_note: note || null,
      });
      if (error) throw error;
      toast({ title: 'Đã duyệt nạp tiền' });
      await fetchAllDeposits();
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const rejectDeposit = async (depositId: string, note?: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('deposit_requests' as any)
        .update({ status: 'rejected', admin_id: user?.id, admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', depositId);
      if (error) throw error;

      // Send rejection notification
      const deposit = allDeposits.find(d => d.id === depositId);
      if (deposit) {
        await supabase.from('notifications').insert({
          user_id: deposit.user_id,
          type: 'deposit_rejected',
          title: 'Nạp tiền bị từ chối',
          message: `Yêu cầu nạp ${deposit.amount.toLocaleString()}₫ đã bị từ chối.${note ? ` Lý do: ${note}` : ''}`,
          related_id: depositId,
        });
      }

      toast({ title: 'Đã từ chối yêu cầu nạp tiền' });
      await fetchAllDeposits();
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  return { allDeposits, isLoading, approveDeposit, rejectDeposit, fetchAllDeposits };
}
