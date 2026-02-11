import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface AvatarCropperProps {
  imageSrc: string;
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export function AvatarCropper({ imageSrc, onComplete, onCancel }: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const CANVAS_SIZE = 280;
  const OUTPUT_SIZE = 400;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      // Fit image to canvas
      const fitScale = CANVAS_SIZE / Math.min(img.width, img.height);
      setScale(fitScale);
      setOffset({
        x: (CANVAS_SIZE - img.width * fitScale) / 2,
        y: (CANVAS_SIZE - img.height * fitScale) / 2,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    ctx.restore();

    // Draw circle border
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [offset, scale]);

  useEffect(() => {
    if (imgLoaded) draw();
  }, [imgLoaded, draw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handlePointerUp = () => setDragging(false);

  const handleScaleChange = (val: number[]) => {
    const img = imgRef.current;
    if (!img) return;
    const oldScale = scale;
    const newScale = val[0];
    // Zoom towards center
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    setOffset({
      x: cx - (cx - offset.x) * (newScale / oldScale),
      y: cy - (cy - offset.y) * (newScale / oldScale),
    });
    setScale(newScale);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = OUTPUT_SIZE;
    outCanvas.height = OUTPUT_SIZE;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    const ratio = OUTPUT_SIZE / CANVAS_SIZE;
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x * ratio, offset.y * ratio, img.width * scale * ratio, img.height * scale * ratio);
    outCanvas.toBlob((blob) => {
      if (blob) onComplete(blob);
    }, 'image/jpeg', 0.9);
  };

  const minScale = imgRef.current
    ? CANVAS_SIZE / Math.max(imgRef.current.width, imgRef.current.height) * 0.3
    : 0.1;
  const maxScale = imgRef.current
    ? CANVAS_SIZE / Math.min(imgRef.current.width, imgRef.current.height) * 3
    : 5;

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa ảnh đại diện</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="relative bg-secondary/50 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>

          <div className="flex items-center gap-3 w-full max-w-[280px]">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[scale]}
              min={minScale}
              max={maxScale}
              step={0.01}
              onValueChange={handleScaleChange}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1 gap-2" onClick={onCancel}>
              <X className="w-4 h-4" /> Hủy
            </Button>
            <Button className="flex-1 gap-2" onClick={handleConfirm}>
              <Check className="w-4 h-4" /> Xác nhận
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
