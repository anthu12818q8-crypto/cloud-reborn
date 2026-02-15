import { useActiveAnnouncements } from '@/hooks/useGlobalAnnouncements';
import { AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export function GlobalAnnouncementOverlay() {
  const { blockingAnnouncement, dismissableAnnouncements, dismiss } = useActiveAnnouncements();

  // Block site mode: prevent any interaction, override everything
  useEffect(() => {
    if (blockingAnnouncement) {
      document.body.style.overflow = 'hidden';
      // Anti-tamper: re-check periodically
      const interval = setInterval(() => {
        const overlay = document.getElementById('site-block-overlay');
        if (!overlay) {
          // Re-mount by forcing re-render
          window.location.reload();
        }
      }, 2000);
      return () => {
        document.body.style.overflow = '';
        clearInterval(interval);
      };
    }
  }, [blockingAnnouncement]);

  // Blocking announcement - fullscreen, unclosable
  if (blockingAnnouncement) {
    return (
      <div
        id="site-block-overlay"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        style={{
          background: 'rgba(0,0,0,0.95)',
          backdropFilter: 'blur(20px)',
          pointerEvents: 'all',
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <div className="max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{blockingAnnouncement.title}</h1>
          <p className="text-muted-foreground text-base md:text-lg whitespace-pre-wrap leading-relaxed">
            {blockingAnnouncement.content}
          </p>
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-muted-foreground/60">Thông báo từ quản trị viên • Không thể đóng</p>
          </div>
        </div>
      </div>
    );
  }

  // Dismissable announcements
  if (dismissableAnnouncements.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="max-w-md w-full space-y-3">
        {dismissableAnnouncements.map(a => (
          <div
            key={a.id}
            className="relative rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10 p-6 animate-in slide-in-from-bottom-4 duration-500"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</p>
              </div>
            </div>
            <Button onClick={() => dismiss(a.id)} className="w-full rounded-xl" variant="outline">
              <X className="w-4 h-4 mr-2" /> Đóng
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
