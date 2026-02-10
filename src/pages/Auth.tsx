import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, Film, CheckCircle2, AlertTriangle, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBlockCheck } from '@/hooks/useBlockCheck';
import { useServerAuth } from '@/hooks/useServerAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  emailSchema, 
  passwordSchema, 
  fullNameSchema, 
} from '@/lib/security';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const [deviceBlocked, setDeviceBlocked] = useState<{ 
    blocked: boolean; 
    remainingSeconds: number; 
    attemptCount: number;
    lockLevel: number;
  }>({
    blocked: false, remainingSeconds: 0, attemptCount: 0, lockLevel: 0
  });
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [registrationBlocked, setRegistrationBlocked] = useState(false);
  
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isBlocked, isChecking, blockReason, recheckBlock } = useBlockCheck();
  const { checkAttempt, recordSuccess, checkRegistrationLimit, detectSuspicious, formatBlockTime } = useServerAuth();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  // Check for suspicious activity on mount
  useEffect(() => {
    const checkSuspicious = async () => {
      const result = await detectSuspicious();
      if (result.blocked) {
        setDeviceBlocked({
          blocked: true,
          remainingSeconds: 86400, // 24 hours
          attemptCount: 5,
          lockLevel: 3,
        });
      }
    };
    checkSuspicious();
  }, [detectSuspicious]);

  // Check registration limit when switching to signup
  useEffect(() => {
    if (!isLogin) {
      const checkRegLimit = async () => {
        const result = await checkRegistrationLimit();
        if (!result.allowed) {
          setRegistrationBlocked(true);
        }
      };
      checkRegLimit();
    } else {
      setRegistrationBlocked(false);
    }
  }, [isLogin, checkRegistrationLimit]);

  // Countdown timer for device block
  useEffect(() => {
    if (deviceBlocked.remainingSeconds > 0) {
      const timer = setInterval(() => {
        setDeviceBlocked(prev => {
          const newRemaining = prev.remainingSeconds - 1;
          if (newRemaining <= 0) {
            return { blocked: false, remainingSeconds: 0, attemptCount: 0, lockLevel: 0 };
          }
          return { ...prev, remainingSeconds: newRemaining };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [deviceBlocked.remainingSeconds]);

  // Show blocked UI if device is blocked
  // Show blocked UI if device is blocked
  if (!isChecking && isBlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-destructive/20 rounded-full flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Thiết bị bị chặn</h1>
            <p className="text-muted-foreground">
              Thiết bị của bạn đã bị chặn truy cập vào hệ thống.
            </p>
            {blockReason && (
              <p className="text-sm text-muted-foreground mt-2">
                Lý do: {blockReason}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Nếu bạn cho rằng đây là sự nhầm lẫn, vui lòng liên hệ quản trị viên.
          </p>
        </div>
      </div>
    );
  }

  // Show registration blocked warning
  if (registrationBlocked && !isLogin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-destructive/20 rounded-full flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Giới hạn đăng ký</h1>
            <p className="text-muted-foreground">
              Thiết bị này đã đạt giới hạn tối đa 3 tài khoản. Bạn không thể tạo thêm tài khoản mới.
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsLogin(true)}>
            Đăng nhập tài khoản có sẵn
          </Button>
        </div>
      </div>
    );
  }

  // Show account deleted warning
  if (accountDeleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-destructive/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-destructive">Tài khoản đã bị xóa</h1>
            <p className="text-muted-foreground">
              Tài khoản này đã bị xóa khỏi hệ thống. Bạn không thể đăng nhập với email này nữa.
            </p>
          </div>
          <Button variant="outline" onClick={() => setAccountDeleted(false)}>
            Quay lại
          </Button>
        </div>
      </div>
    );
  }
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Validate email
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    // Validate password (stricter for signup)
    if (!isLogin) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }

      // Validate full name for signup
      if (fullName) {
        const nameResult = fullNameSchema.safeParse(fullName);
        if (!nameResult.success) {
          newErrors.fullName = nameResult.error.errors[0].message;
        }
      }
    } else {
      // Basic validation for login
      if (password.length < 6) {
        newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if device is blocked (permanent)
    if (isBlocked) {
      toast({
        title: 'Thiết bị bị chặn',
        description: 'Bạn không thể đăng nhập từ thiết bị này',
        variant: 'destructive'
      });
      return;
    }

    // Check if device is temporarily blocked
    if (deviceBlocked.blocked) {
      toast({
        title: 'Tạm thời bị khoá',
        description: `Vui lòng đợi ${formatBlockTime(deviceBlocked.remainingSeconds)}`,
        variant: 'destructive'
      });
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      if (isLogin) {
        // Try to login first
        const { error } = await signIn(email, password);
        
        if (error) {
          // Record failed attempt via server-side check
          const result = await checkAttempt('login');
          
          if (result.blocked) {
            const lockMinutes = result.lock_level === 1 ? 15 : result.lock_level === 2 ? 30 : 1440;
            setDeviceBlocked({
              blocked: true,
              remainingSeconds: result.remaining_seconds || lockMinutes * 60,
              attemptCount: result.attempt_count || 0,
              lockLevel: result.lock_level || 0,
            });
            
            recheckBlock();
            
            const lockDesc = result.lock_level === 1 ? '15 phút' : result.lock_level === 2 ? '30 phút' : '24 giờ';
            toast({
              title: 'Thiết bị bị khoá',
              description: `Đăng nhập thất bại ${result.attempt_count} lần. Khoá ${lockDesc}.`,
              variant: 'destructive'
            });
            return;
          }
          
          // Show remaining attempts warning
          if (result.attempts_remaining && result.attempts_remaining <= 2) {
            toast({
              title: 'Cảnh báo',
              description: `Còn ${result.attempts_remaining} lần thử. Sau đó thiết bị sẽ bị khoá.`,
              variant: 'destructive'
            });
          }
          
          throw error;
        }
        
        // Record successful login
        await recordSuccess('login');
        
        toast({
          title: 'Đăng nhập thành công!'
        });
        navigate('/');
      } else {
        // Check registration limit first
        const regCheck = await checkRegistrationLimit();
        if (!regCheck.allowed) {
          setRegistrationBlocked(true);
          toast({
            title: 'Giới hạn đăng ký',
            description: 'Thiết bị này đã đạt giới hạn tối đa 3 tài khoản.',
            variant: 'destructive'
          });
          return;
        }

        // Check if already too many signup attempts
        const preCheck = await checkAttempt('signup');
        if (preCheck.blocked) {
          setDeviceBlocked({
            blocked: true,
            remainingSeconds: preCheck.remaining_seconds || 86400,
            attemptCount: preCheck.attempt_count || 0,
            lockLevel: preCheck.lock_level || 3,
          });
          recheckBlock();
          
          toast({
            title: 'Thiết bị bị khoá',
            description: 'Tạo tài khoản quá nhiều lần. Thiết bị bị khoá 24 giờ.',
            variant: 'destructive'
          });
          return;
        }
        
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        
        // Get new user and record success with device registration
        const { data: { user: newUser } } = await supabase.auth.getUser();
        if (newUser) {
          await recordSuccess('signup', newUser.id);
        }
        
        toast({
          title: 'Đăng ký thành công!'
        });
        navigate('/');
      }
    } catch (error: any) {
      if (error.message?.includes('User not found') || 
          (error.message?.includes('Invalid login credentials') && isLogin)) {
        toast({
          title: 'Đăng nhập thất bại',
          description: 'Email hoặc mật khẩu không đúng.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Lỗi',
          description: error.message || 'Đã xảy ra lỗi, vui lòng thử lại',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = ['Xem phim không giới hạn', 'Chất lượng Full HD', 'Không quảng cáo', 'Hỗ trợ đa nền tảng'];

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <div className="min-h-screen bg-background relative overflow-hidden flex">
      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Left Side - Branding (Desktop) */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center p-12">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] animate-pulse-slow" style={{
        animationDelay: '1s'
      }} />
        
        <div className="relative z-10 max-w-lg space-y-8 animate-fade-in">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
              <Sparkles className="relative w-12 h-12 text-primary" />
            </div>
            <span className="font-display text-4xl font-bold">
              <span className="text-gradient">ANND</span>
              <span>PHIM</span>
            </span>
          </Link>

          <div className="space-y-4">
            <h1 className="font-display text-5xl font-bold leading-tight">
              Trải nghiệm điện ảnh
              <br />
              <span className="text-gradient">đỉnh cao</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Khám phá hàng ngàn bộ phim đa dạng với chất lượng hình ảnh tuyệt vời và trải nghiệm xem không gián đoạn.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => <div key={index} className="flex items-center gap-3 text-sm opacity-0 animate-fade-in" style={{
            animationDelay: `${0.3 + index * 0.1}s`,
            animationFillMode: 'forwards'
          }}>
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </div>)}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <Link to="/" className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Sparkles className="w-8 h-8 text-primary" />
            <span className="font-display text-2xl font-bold">
              <span className="text-gradient">ANND</span>
              <span>PHIM</span>
            </span>
          </Link>

          {/* Card */}
          <div className="glass-card p-8 md:p-10 space-y-8 animate-scale-in">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="font-display text-3xl font-bold">
                {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản'}
              </h2>
              <p className="text-muted-foreground">
                {isLogin ? 'Đăng nhập để tiếp tục' : 'Đăng ký miễn phí ngay hôm nay'}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex p-1.5 bg-secondary/50 rounded-xl">
              <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${isLogin ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
                Đăng nhập
              </button>
              <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${!isLogin ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
                Đăng ký
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2 animate-slide-up">
                  <Label htmlFor="fullName" className="text-sm font-medium">Họ và tên</Label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-primary/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input id="fullName" placeholder="Nhập họ và tên" value={fullName} onChange={e => { setFullName(e.target.value); setErrors(prev => ({ ...prev, fullName: undefined })); }} className={`pl-12 h-13 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${errors.fullName ? 'border-destructive' : ''}`} />
                    </div>
                  </div>
                  {errors.fullName && <p className="text-xs text-destructive pl-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.fullName}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }} className={`pl-12 h-13 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${errors.email ? 'border-destructive' : ''}`} required />
                  </div>
                </div>
                {errors.email && <p className="text-xs text-destructive pl-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Mật khẩu</Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }} className={`pl-12 pr-12 h-13 bg-secondary/50 border-border/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${errors.password ? 'border-destructive' : ''}`} required minLength={6} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {errors.password && <p className="text-xs text-destructive pl-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors.password}</p>}
                {!isLogin && !errors.password && <p className="text-xs text-muted-foreground pl-1">Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt</p>}
              </div>

              <Button type="submit" className="w-full h-13 btn-primary rounded-xl text-base font-semibold gap-2 group" disabled={isLoading}>
                {isLoading ? <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Đang xử lý...
                  </div> : <>
                    {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-4 text-muted-foreground">hoặc</span>
              </div>
            </div>

            {/* Alternative Action */}
            <Button variant="ghost" onClick={() => navigate('/')} className="w-full h-12 rounded-xl text-muted-foreground hover:text-foreground gap-2">
              <Film className="w-5 h-5" />
              Quay về trang chủ
            </Button>
          </div>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground">
            Bằng việc đăng ký, bạn đồng ý với{' '}
            <a href="#" className="text-primary hover:underline">Điều khoản sử dụng</a>
            {' '}và{' '}
            <a href="#" className="text-primary hover:underline">Chính sách bảo mật</a>
          </p>
        </div>
      </div>
    </div>;
}
