import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PaymentComplaint {
  id: string;
  payment_request_id: string;
  user_id: string;
  reason: string;
  image_url: string | null;
  status: 'pending' | 'resolved' | 'rejected';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  profiles?: { email: string; full_name: string | null };
  payment_requests?: { 
    amount: number; 
    status: string;
    movies?: { title: string; poster_url: string | null };
  };
}

export function useAdminComplaints() {
  const { isAdmin } = useAuth();
  const [complaints, setComplaints] = useState<PaymentComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComplaints = useCallback(async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      // Fetch complaints
      const { data: complaintsData, error: complaintsError } = await supabase
        .from('payment_complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (complaintsError) throw complaintsError;

      // Get unique IDs
      const userIds = [...new Set((complaintsData || []).map(c => c.user_id))];
      const paymentIds = [...new Set((complaintsData || []).map(c => c.payment_request_id))];

      // Fetch related data
      const [profilesRes, paymentsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, email, full_name').in('id', userIds)
          : { data: [], error: null },
        paymentIds.length > 0
          ? supabase.from('payment_requests').select('id, amount, status, movie_id').in('id', paymentIds)
          : { data: [], error: null }
      ]);

      // Fetch movies for payments
      const movieIds = [...new Set((paymentsRes.data || []).map(p => p.movie_id))];
      const moviesRes = movieIds.length > 0
        ? await supabase.from('movies').select('id, title, poster_url').in('id', movieIds)
        : { data: [] };

      // Create maps
      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const moviesMap = new Map((moviesRes.data || []).map(m => [m.id, m]));
      const paymentsMap = new Map((paymentsRes.data || []).map(p => [p.id, {
        ...p,
        movies: moviesMap.get(p.movie_id) || null
      }]));

      // Merge data
      const data = (complaintsData || []).map(c => ({
        ...c,
        profiles: profilesMap.get(c.user_id) || null,
        payment_requests: paymentsMap.get(c.payment_request_id) || null,
      }));

      setComplaints(data as unknown as PaymentComplaint[]);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const updateComplaintStatus = async (
    complaintId: string,
    status: 'resolved' | 'rejected',
    adminResponse?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('payment_complaints')
        .update({
          status,
          admin_response: adminResponse || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', complaintId);

      if (error) throw error;

      // Get complaint details to send notification
      const complaint = complaints.find(c => c.id === complaintId);
      if (complaint) {
        await supabase.from('notifications').insert({
          user_id: complaint.user_id,
          type: 'complaint_response',
          title: status === 'resolved' ? 'Khiếu nại đã được giải quyết' : 'Khiếu nại bị từ chối',
          message: adminResponse || (status === 'resolved' 
            ? 'Khiếu nại của bạn đã được xem xét và giải quyết.' 
            : 'Khiếu nại của bạn đã bị từ chối.'),
          related_id: complaint.payment_request_id,
        });
      }

      await fetchComplaints();
      return true;
    } catch (error) {
      console.error('Error updating complaint:', error);
      return false;
    }
  };

  return {
    complaints,
    isLoading,
    fetchComplaints,
    updateComplaintStatus,
  };
}
