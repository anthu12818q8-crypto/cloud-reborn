import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GlobalAnnouncement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  block_site: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useGlobalAnnouncements() {
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('global_announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data as unknown as GlobalAnnouncement[]);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const createAnnouncement = async (title: string, content: string, blockSite: boolean) => {
    const { error } = await supabase.from('global_announcements').insert({
      title, content, block_site: blockSite, is_active: true,
    } as any);
    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Đã tạo thông báo' });
    fetchAnnouncements();
    return true;
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('global_announcements').update({ is_active: isActive } as any).eq('id', id);
    fetchAnnouncements();
  };

  const toggleBlockSite = async (id: string, blockSite: boolean) => {
    await supabase.from('global_announcements').update({ block_site: blockSite } as any).eq('id', id);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('global_announcements').delete().eq('id', id);
    fetchAnnouncements();
  };

  return { announcements, loading, createAnnouncement, toggleActive, toggleBlockSite, deleteAnnouncement, fetchAnnouncements };
}

// Hook for user-facing: get active announcements
export function useActiveAnnouncements() {
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('global_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (data) setAnnouncements(data as unknown as GlobalAnnouncement[]);
      setLoading(false);
    };
    fetch();

    // Realtime subscription
    const channel = supabase
      .channel('global_announcements_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_announcements' }, () => {
        fetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const dismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const blockingAnnouncement = announcements.find(a => a.block_site);
  const dismissableAnnouncements = announcements.filter(a => !a.block_site && !dismissed.has(a.id));

  return { blockingAnnouncement, dismissableAnnouncements, dismiss, loading };
}
