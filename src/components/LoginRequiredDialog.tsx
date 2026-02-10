import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';

interface LoginRequiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginRequiredDialog({ isOpen, onClose }: LoginRequiredDialogProps) {
  const navigate = useNavigate();

  const handleLogin = () => {
    onClose();
    navigate('/auth');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">Yêu cầu đăng nhập</DialogTitle>
          <DialogDescription className="text-center">
            Bạn cần đăng nhập để xem phim này
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <LogIn className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2">
            <Button className="w-full gap-2" onClick={handleLogin}>
              <LogIn className="w-4 h-4" />
              Đăng nhập
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={handleLogin}>
              <UserPlus className="w-4 h-4" />
              Đăng ký tài khoản mới
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
