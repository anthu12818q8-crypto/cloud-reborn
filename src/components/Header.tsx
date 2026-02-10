import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, User, LogOut, Settings, ChevronDown, Sparkles, Triangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from '@/components/NotificationBell';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const {
    user,
    isAdmin,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  const navLinks = [{
    href: '/',
    label: 'Trang chủ'
  }, {
    href: '/browse',
    label: 'Phim'
  }, {
    href: '/genres',
    label: 'Thể loại'
  }];
  return <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'glass py-2' : 'bg-gradient-to-b from-background/90 via-background/50 to-transparent py-3 sm:py-4'} ${className || ''}`}>
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors" />
                <Triangle className="relative w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <span className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                <span className="text-gradient">ANND</span>
                <span className="text-foreground">Phim</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center">
              <div className="flex items-center gap-1 p-1 rounded-full glass-button">
                {navLinks.map(link => <Link key={link.href} to={link.href} className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${location.pathname === link.href ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                    {link.label}
                  </Link>)}
              </div>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Search */}
              <div className="relative">
                {isSearchOpen ? <form onSubmit={handleSearch} className="flex items-center animate-scale-in absolute right-0 top-1/2 -translate-y-1/2 sm:relative sm:translate-y-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="search" placeholder="Tìm kiếm phim..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-40 sm:w-48 md:w-72 pl-10 h-10 sm:h-11 bg-secondary/80 border-border/50 rounded-full focus:ring-2 focus:ring-primary/30 text-sm" autoFocus />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setIsSearchOpen(false)} className="ml-1 sm:ml-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full">
                      <X className="h-4 w-4" />
                    </Button>
                  </form> : <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="h-9 w-9 sm:h-11 sm:w-11 rounded-full glass-button">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>}
              </div>

              {/* Notification Bell */}
              <NotificationBell />

              {/* User Menu */}
              {user ? <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-11 gap-2 rounded-full px-2 glass-button">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 glass-card p-2">
                    <div className="px-3 py-3 rounded-xl bg-secondary/50">
                      <p className="text-sm font-semibold truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        {isAdmin && <Sparkles className="w-3 h-3 text-primary" />}
                        {isAdmin ? 'Quản trị viên' : 'Thành viên'}
                      </p>
                    </div>
                    <DropdownMenuSeparator className="my-2" />
                    {isAdmin && <>
                        <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer rounded-lg py-2.5">
                          <Settings className="mr-3 h-4 w-4" />
                          Quản trị phim
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2" />
                      </>}
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer rounded-lg py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10">
                      <LogOut className="mr-3 h-4 w-4" />
                      Đăng xuất
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu> : <Button onClick={() => navigate('/auth')} className="btn-primary rounded-full px-4 sm:px-6 h-9 sm:h-11 font-semibold text-sm sm:text-base">
                  Đăng nhập
                </Button>}

              {/* Mobile Menu Toggle */}
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 sm:h-11 sm:w-11 rounded-full glass-button flex-shrink-0" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && <nav className="md:hidden mt-4 pb-4 animate-slide-up">
              <div className="flex flex-col gap-2 glass-card p-3">
                {navLinks.map(link => <Link key={link.href} to={link.href} onClick={() => setIsMenuOpen(false)} className={`px-4 py-3 rounded-xl font-medium transition-all ${location.pathname === link.href ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}>
                    {link.label}
                  </Link>)}
              </div>
            </nav>}
        </div>
      </header>

      {/* Spacer */}
      <div className="h-20" />
    </>;
}