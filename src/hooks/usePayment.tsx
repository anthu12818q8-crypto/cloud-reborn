import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { logger } from '@/lib/logger';

export interface PaymentRequest {
  id: string;
  user_id: string;
  movie_id: string;
  amount: number;
  proof_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_id: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profiles?: { email: string; full_name: string | null };
  movies?: { title: string; poster_url: string | null };
}

export function usePayment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myPayments, setMyPayments] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMyPayments = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyPayments((data || []) as PaymentRequest[]);
    } catch (error) {
      logger.error('Error fetching payments:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchMyPayments();
  }, [fetchMyPayments]);

  const hasApprovedPayment = useCallback((movieId: string): boolean => {
    return myPayments.some(p => p.movie_id === movieId && p.status === 'approved');
  }, [myPayments]);

  const getPendingPayment = useCallback((movieId: string): PaymentRequest | undefined => {
    return myPayments.find(p => p.movie_id === movieId && p.status === 'pending');
  }, [myPayments]);

  const submitPaymentRequest = async (
    movieId: string,
    amount: number,
    proofFile: File
  ): Promise<boolean> => {
    if (!user) {
      toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
      return false;
    }

    setIsLoading(true);
    try {
      // Upload proof image
      const ext = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${movieId}_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      // Create payment request
      const { error: insertError } = await supabase
        .from('payment_requests')
        .upsert({
          user_id: user.id,
          movie_id: movieId,
          amount,
          proof_image_url: urlData.publicUrl,
          status: 'pending',
        }, {
          onConflict: 'user_id,movie_id',
        });

      if (insertError) throw insertError;

      toast({ title: 'Gửi yêu cầu thanh toán thành công', description: 'Vui lòng chờ admin xác nhận' });
      await fetchMyPayments();
      return true;
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      toast({ title: 'Lỗi gửi yêu cầu', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    myPayments,
    isLoading,
    hasApprovedPayment,
    getPendingPayment,
    submitPaymentRequest,
    fetchMyPayments,
  };
}

// Admin hook for managing all payment requests
export function useAdminPayments() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllPayments = useCallback(async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      // Fetch payment requests first
      const { data: payments, error: paymentError } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentError) throw paymentError;

      // Fetch profiles and movies separately
      const userIds = [...new Set((payments || []).map(p => p.user_id))];
      const movieIds = [...new Set((payments || []).map(p => p.movie_id))];

      const [profilesRes, moviesRes] = await Promise.all([
        userIds.length > 0 
          ? supabase.from('profiles').select('id, email, full_name').in('id', userIds)
          : { data: [], error: null },
        movieIds.length > 0
          ? supabase.from('movies').select('id, title, poster_url').in('id', movieIds)
          : { data: [], error: null }
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const moviesMap = new Map((moviesRes.data || []).map(m => [m.id, m]));

      const data = (payments || []).map(p => ({
        ...p,
        profiles: profilesMap.get(p.user_id) || null,
        movies: moviesMap.get(p.movie_id) || null,
      }));

      setAllPayments(data as unknown as PaymentRequest[]);
    } catch (error) {
      console.error('Error fetching all payments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchAllPayments();
  }, [fetchAllPayments]);

  const updatePaymentStatus = async (
    paymentId: string,
    status: 'approved' | 'rejected',
    adminNote?: string
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update payment status
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status,
          admin_id: user?.id,
          admin_note: adminNote || null,
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Send notification to user
      const payment = allPayments.find(p => p.id === paymentId);
      if (payment) {
        await supabase.from('notifications').insert({
          user_id: payment.user_id,
          type: status === 'approved' ? 'payment_approved' : 'payment_rejected',
          title: status === 'approved' ? 'Thanh toán được chấp nhận' : 'Thanh toán bị từ chối',
          message: status === 'approved' 
            ? `Thanh toán của bạn cho phim "${(payment.movies as any)?.title || 'Phim'}" đã được duyệt. Bạn có thể xem phim ngay bây giờ!`
            : `Thanh toán của bạn cho phim "${(payment.movies as any)?.title || 'Phim'}" đã bị từ chối.${adminNote ? ` Lý do: ${adminNote}` : ''}`,
          related_id: paymentId,
        });
      }

      toast({ title: status === 'approved' ? 'Đã duyệt thanh toán' : 'Đã từ chối thanh toán' });
      await fetchAllPayments();
      return true;
    } catch (error: any) {
      console.error('Error updating payment:', error);
      toast({ title: 'Lỗi cập nhật', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  return {
    allPayments,
    isLoading,
    updatePaymentStatus,
    fetchAllPayments,
  };
}
