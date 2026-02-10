import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface AccountDeletedDialogProps {
  open: boolean;
  reason?: string;
  onClose: () => void;
}

export function AccountDeletedDialog({ open, reason, onClose }: AccountDeletedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="border-destructive/50">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-destructive/20">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-destructive">
              Tài khoản đã bị xóa
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-4">
            <p>
              Tài khoản của bạn đã bị quản trị viên xóa khỏi hệ thống.
            </p>
            {reason && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm font-medium text-foreground">Lý do:</p>
                <p className="text-sm text-muted-foreground mt-1">{reason}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Bạn không thể tiếp tục sử dụng dịch vụ. Nếu bạn cho rằng đây là nhầm lẫn, 
              vui lòng liên hệ quản trị viên.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={onClose} variant="destructive">
            Đã hiểu
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
