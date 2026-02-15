import { useState } from 'react';
import { Plus, Trash2, Shield, ShieldOff, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useGlobalAnnouncements } from '@/hooks/useGlobalAnnouncements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function AdminAnnouncements() {
  const { announcements, loading, createAnnouncement, toggleActive, toggleBlockSite, deleteAnnouncement } = useGlobalAnnouncements();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [blockSite, setBlockSite] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    const ok = await createAnnouncement(title, content, blockSite);
    if (ok) {
      setTitle(''); setContent(''); setBlockSite(false); setOpen(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Thông báo chung</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Tạo thông báo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tạo thông báo mới</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tiêu đề</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề thông báo..." />
              </div>
              <div className="space-y-2">
                <Label>Nội dung</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Nội dung thông báo..." rows={4} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <div>
                  <p className="font-medium text-sm text-destructive">Chặn toàn web</p>
                  <p className="text-xs text-muted-foreground">Người dùng không thể đóng hoặc bypass thông báo</p>
                </div>
                <Switch checked={blockSite} onCheckedChange={setBlockSite} />
              </div>
              <Button onClick={handleCreate} className="w-full">Tạo thông báo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {announcements.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Chưa có thông báo nào</p>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={`p-4 rounded-xl border ${a.block_site ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{a.title}</h3>
                    {a.block_site && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground font-medium">Chặn web</span>}
                    {!a.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Tắt</span>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString('vi-VN')}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => toggleActive(a.id, !a.is_active)} title={a.is_active ? 'Tắt' : 'Bật'}>
                    {a.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleBlockSite(a.id, !a.block_site)} title={a.block_site ? 'Bỏ chặn' : 'Chặn web'}>
                    {a.block_site ? <Shield className="w-4 h-4 text-destructive" /> : <ShieldOff className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteAnnouncement(a.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
