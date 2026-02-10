import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UserWithDevice {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  devices: {
    fingerprint: string;
    ip_address: unknown;
    user_agent: string | null;
    last_seen_at: string;
  }[];
}

interface BlockedDevice {
  id: string;
  fingerprint: string;
  ip_address: string | null;
  reason: string | null;
  created_at: string;
}

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string | null;
  created_at: string;
}

export function useUserManagement() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDevice[]>([]);
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      // Fetch profiles with device info
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch device info for all users
      const { data: devices, error: devicesError } = await supabase
        .from('user_device_info')
        .select('*');

      if (devicesError) throw devicesError;

      // Combine data
      const usersWithDevices: UserWithDevice[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        created_at: profile.created_at,
        devices: (devices || [])
          .filter(d => d.user_id === profile.id)
          .map(d => ({
            fingerprint: d.fingerprint,
            ip_address: d.ip_address,
            user_agent: d.user_agent,
            last_seen_at: d.last_seen_at,
          })),
      }));

      setUsers(usersWithDevices);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  const fetchBlockedDevices = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('blocked_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedDevices((data || []) as BlockedDevice[]);
    } catch (error) {
      console.error('Error fetching blocked devices:', error);
    }
  }, [isAdmin]);

  const fetchBlockedIps = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedIps((data || []) as BlockedIp[]);
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
    fetchBlockedDevices();
    fetchBlockedIps();
  }, [fetchUsers, fetchBlockedDevices, fetchBlockedIps]);

  const blockDevice = async (fingerprint: string, ipAddress?: string | null, reason?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('blocked_devices')
        .insert({
          fingerprint,
          ip_address: ipAddress || null,
          blocked_by: user?.id,
          reason: reason || null,
        });

      if (error) throw error;

      toast({ title: 'Đã chặn thiết bị' });
      await fetchBlockedDevices();
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Thiết bị đã bị chặn trước đó', variant: 'destructive' });
      } else {
        toast({ title: 'Lỗi chặn thiết bị', description: error.message, variant: 'destructive' });
      }
      return false;
    }
  };

  const unblockDevice = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('blocked_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Đã bỏ chặn thiết bị' });
      await fetchBlockedDevices();
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi bỏ chặn', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const blockIp = async (ipAddress: string, reason?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('blocked_ips')
        .insert({
          ip_address: ipAddress,
          blocked_by: user?.id,
          reason: reason || null,
        });

      if (error) throw error;

      toast({ title: 'Đã chặn IP' });
      await fetchBlockedIps();
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'IP đã bị chặn trước đó', variant: 'destructive' });
      } else {
        toast({ title: 'Lỗi chặn IP', description: error.message, variant: 'destructive' });
      }
      return false;
    }
  };

  const unblockIp = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('blocked_ips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Đã bỏ chặn IP' });
      await fetchBlockedIps();
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi bỏ chặn', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');

      toast({ title: 'Đã xóa người dùng vĩnh viễn' });
      await fetchUsers();
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi xóa người dùng', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const blockUserCompletely = async (
    userId: string,
    fingerprint?: string,
    ipAddress?: string | null,
    reason?: string
  ): Promise<boolean> => {
    try {
      // Block device if fingerprint provided
      if (fingerprint) {
        await blockDevice(fingerprint, ipAddress, reason);
      }

      // Block IP if provided
      if (ipAddress) {
        await blockIp(ipAddress, reason);
      }

      toast({ title: 'Đã chặn người dùng và thiết bị' });
      return true;
    } catch (error: any) {
      toast({ title: 'Lỗi chặn người dùng', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  return {
    users,
    blockedDevices,
    blockedIps,
    isLoading,
    blockDevice,
    unblockDevice,
    blockIp,
    unblockIp,
    deleteUser,
    blockUserCompletely,
    refresh: () => {
      fetchUsers();
      fetchBlockedDevices();
      fetchBlockedIps();
    },
  };
}
