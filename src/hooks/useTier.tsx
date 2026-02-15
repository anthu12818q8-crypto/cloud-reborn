import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TierSetting {
  id: string;
  tier_key: string;
  display_name: string;
  min_amount: number;
  color: string;
  icon: string;
  display_order: number;
}

export interface UserTierInfo {
  tier: TierSetting | null;
  balance: number;
  totalDeposited: number;
}

export function useTier() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<TierSetting[]>([]);
  const [userInfo, setUserInfo] = useState<UserTierInfo>({ tier: null, balance: 0, totalDeposited: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchTiers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tier_settings' as any)
        .select('*')
        .order('display_order', { ascending: true });
      if (!error && data) setTiers(data as any);
    } catch {
      // Table may not exist yet
    }
  }, []);

  const fetchUserBalance = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const totalDeposited = (data as any).total_deposited || 0;
        const balance = (data as any).balance || 0;

        const matchingTier = [...tiers]
          .sort((a, b) => b.min_amount - a.min_amount)
          .find(t => totalDeposited >= t.min_amount);

        setUserInfo({ tier: matchingTier || null, balance, totalDeposited });
      }
    } catch {
      // Columns may not exist yet
    }
  }, [user, tiers]);

  useEffect(() => {
    fetchTiers().then(() => setIsLoading(false));
  }, [fetchTiers]);

  useEffect(() => {
    if (tiers.length > 0 && user) fetchUserBalance();
  }, [tiers, user, fetchUserBalance]);

  return { tiers, userInfo, isLoading, fetchTiers, fetchUserBalance };
}
