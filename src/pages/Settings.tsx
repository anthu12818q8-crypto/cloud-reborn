import { useState, useRef } from 'react';
import { DepositSection } from '@/components/DepositSection';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Save, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AvatarCropper } from '@/components/AvatarCropper';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url);
      }
      setIsLoading(false);
    };
    fetchProfile();
  }, [user, navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;
    setCropImage(null);
    setIsSaving(true);

    const fileName = `${user.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) {
      toast({ title: 'Lỗi', description: 'Không thể tải ảnh lên', variant: 'destructive' });
      setIsSaving(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', user.id);
    setAvatarUrl(newUrl);
    setIsSaving(false);
    toast({ title: 'Đã cập nhật ảnh đại diện' });
  };

  const handleSaveName = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id);
    
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật tên', variant: 'destructive' });
    } else {
      toast({ title: 'Đã cập nhật tên tài khoản' });
    }
    setIsSaving(false);
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 container mx-auto px-4 flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16 container mx-auto px-4">
        <div className="max-w-lg mx-auto space-y-8">
          <h1 className="font-display text-2xl sm:text-3xl">Cài đặt tài khoản</h1>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="w-28 h-28 border-4 border-primary/30">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Avatar" />
                ) : null}
                <AvatarFallback className="text-3xl bg-primary/20 text-primary">
                  {fullName ? fullName.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Thay đổi ảnh đại diện
            </Button>
          </div>

          {/* Name */}
          <div className="space-y-3">
            <Label htmlFor="fullName">Tên hiển thị</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập tên hiển thị..."
              className="bg-secondary/50"
            />
            <p className="text-xs text-muted-foreground">Tên này sẽ hiển thị ở bình luận phim</p>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-3">
            <Label>Email</Label>
            <Input value={user.email || ''} disabled className="bg-secondary/30 opacity-60" />
          </div>

          <Button onClick={handleSaveName} disabled={isSaving} className="w-full gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi
          </Button>

          {/* Deposit & Balance Section */}
          <div className="border-t border-border pt-8">
            <DepositSection />
          </div>
        </div>
      </main>
      <Footer />

      {cropImage && (
        <AvatarCropper
          imageSrc={cropImage}
          onComplete={handleCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}
    </div>
  );
}
