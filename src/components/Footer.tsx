import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone, Heart, Triangle } from 'lucide-react';
export function Footer() {
  const currentYear = new Date().getFullYear();
  return <footer className="relative border-t border-border/50 mt-20">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 py-16 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-6">
            <Link to="/" className="inline-flex items-center gap-2">
              <Triangle className="w-7 h-7 text-primary" />
              <span className="font-display text-2xl font-bold">
                <span className="text-gradient">ANND</span>
                <span>Phim</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Trải nghiệm xem phim trực tuyến đỉnh cao với hàng ngàn bộ phim chất lượng HD.
            </p>
            <div className="flex gap-3">
              {[{
              icon: Facebook,
              href: '#'
            }, {
              icon: Twitter,
              href: '#'
            }, {
              icon: Instagram,
              href: '#'
            }, {
              icon: Youtube,
              href: '#'
            }].map((social, index) => <a key={index} href={social.href} className="w-10 h-10 rounded-full glass-button flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
                  <social.icon className="w-4 h-4" />
                </a>)}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-5">
            <h4 className="font-display text-lg font-semibold">Khám phá</h4>
            <ul className="space-y-3 text-sm">
              {[{
              label: 'Tất cả phim',
              to: '/browse'
            }, {
              label: 'Thể loại',
              to: '/genres'
            }, {
              label: 'Phim mới',
              to: '/browse'
            }, {
              label: 'Phim hot',
              to: '/browse'
            }].map((link, index) => <li key={index}>
                  <Link to={link.to} className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2 group">
                    <span className="w-0 h-px bg-primary group-hover:w-3 transition-all" />
                    {link.label}
                  </Link>
                </li>)}
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-5">
            <h4 className="font-display text-lg font-semibold">Hỗ trợ</h4>
            <ul className="space-y-3 text-sm">
              {[{
              label: 'Câu hỏi thường gặp',
              href: '#'
            }, {
              label: 'Liên hệ',
              href: '#'
            }, {
              label: 'Điều khoản sử dụng',
              href: '#'
            }, {
              label: 'Chính sách bảo mật',
              href: '#'
            }].map((link, index) => <li key={index}>
                  <a href={link.href} className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2 group">
                    <span className="w-0 h-px bg-primary group-hover:w-3 transition-all" />
                    {link.label}
                  </a>
                </li>)}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-5">
            <h4 className="font-display text-lg font-semibold">Liên hệ</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 text-primary" />
                
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 mt-0.5 text-primary" />
                <span>
              </span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                <span>
              </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Made with <Heart className="w-4 h-4 text-primary" fill="currentColor" /> in Vietnam
            </p>
          </div>
        </div>
      </div>
    </footer>;
}