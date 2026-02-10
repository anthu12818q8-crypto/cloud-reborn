
-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. USER ROLES TABLE
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User roles viewable by owner" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 3. MOVIES TABLE
-- ============================================
CREATE TABLE public.movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  video_url TEXT,
  genre TEXT[],
  release_year INT,
  duration INT,
  actors TEXT[],
  director TEXT,
  imdb_rating NUMERIC,
  view_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  display_order INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  requires_payment BOOLEAN DEFAULT false,
  payment_amount NUMERIC,
  payment_image_url TEXT,
  ad_video_url TEXT,
  ad_position TEXT,
  ad_enabled BOOLEAN DEFAULT false,
  ad_show_on_load BOOLEAN DEFAULT false,
  intro_start_seconds NUMERIC,
  intro_end_seconds NUMERIC,
  has_episodes BOOLEAN DEFAULT false,
  episode_count INT
);
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movies viewable by everyone" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Admins can insert movies" ON public.movies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update movies" ON public.movies FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete movies" ON public.movies FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 4. EPISODES TABLE
-- ============================================
CREATE TABLE public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  episode_number INT NOT NULL,
  title TEXT,
  video_url TEXT NOT NULL,
  duration INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(movie_id, episode_number)
);
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Episodes viewable by everyone" ON public.episodes FOR SELECT USING (true);
CREATE POLICY "Admins can manage episodes" ON public.episodes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 5. FAVORITES TABLE
-- ============================================
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, movie_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- ============================================
-- 7. WATCH HISTORY TABLE
-- ============================================
CREATE TABLE public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  progress_seconds INT NOT NULL DEFAULT 0,
  duration_seconds INT,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, movie_id)
);
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own watch history" ON public.watch_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own watch history" ON public.watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watch history" ON public.watch_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watch history" ON public.watch_history FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 8. PAYMENT REQUESTS TABLE
-- ============================================
CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  proof_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id UUID,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, movie_id)
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payment_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payment_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can upsert own payments" ON public.payment_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON public.payment_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update payments" ON public.payment_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 9. PAYMENT COMPLAINTS TABLE
-- ============================================
CREATE TABLE public.payment_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own complaints" ON public.payment_complaints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own complaints" ON public.payment_complaints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all complaints" ON public.payment_complaints FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update complaints" ON public.payment_complaints FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 10. LOGIN ATTEMPTS TABLE
-- ============================================
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  ip_address INET,
  attempt_count INT NOT NULL DEFAULT 0,
  lock_level INT DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_violations INT DEFAULT 0,
  attempt_type TEXT NOT NULL DEFAULT 'login'
);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view login attempts" ON public.login_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete login attempts" ON public.login_attempts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 11. BLOCKED DEVICES TABLE
-- ============================================
CREATE TABLE public.blocked_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  ip_address INET,
  reason TEXT,
  blocked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can check blocked devices" ON public.blocked_devices FOR SELECT USING (true);
CREATE POLICY "Admins can manage blocked devices" ON public.blocked_devices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 12. BLOCKED IPS TABLE
-- ============================================
CREATE TABLE public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  reason TEXT,
  blocked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view blocked IPs" ON public.blocked_ips FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 13. USER DEVICE INFO TABLE
-- ============================================
CREATE TABLE public.user_device_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);
ALTER TABLE public.user_device_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view device info" ON public.user_device_info FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "System can insert device info" ON public.user_device_info FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update device info" ON public.user_device_info FOR UPDATE USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- is_device_blocked function
CREATE OR REPLACE FUNCTION public.is_device_blocked(p_fingerprint TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_devices WHERE fingerprint = p_fingerprint
  );
END;
$$;

-- get_playback_url function
CREATE OR REPLACE FUNCTION public.get_playback_url(p_movie_id UUID, p_episode_number INT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
BEGIN
  IF p_episode_number IS NOT NULL THEN
    SELECT video_url INTO v_url FROM public.episodes
    WHERE movie_id = p_movie_id AND episode_number = p_episode_number;
  ELSE
    SELECT video_url INTO v_url FROM public.movies WHERE id = p_movie_id;
  END IF;
  
  IF v_url IS NULL THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002';
  END IF;
  
  RETURN v_url;
END;
$$;

-- get_ad_playback_url function
CREATE OR REPLACE FUNCTION public.get_ad_playback_url(p_movie_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
BEGIN
  SELECT ad_video_url INTO v_url FROM public.movies
  WHERE id = p_movie_id AND ad_enabled = true;
  RETURN v_url;
END;
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_movies_updated_at BEFORE UPDATE ON public.movies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_episodes_updated_at BEFORE UPDATE ON public.episodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_requests_updated_at BEFORE UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_complaints_updated_at BEFORE UPDATE ON public.payment_complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-images', 'complaint-images', true);

-- Storage policies for videos
CREATE POLICY "Videos publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Admins can upload videos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'videos' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete videos" ON storage.objects FOR DELETE USING (
  bucket_id = 'videos' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Storage policies for payment-proofs
CREATE POLICY "Payment proofs publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');
CREATE POLICY "Users can upload payment proofs" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL
);

-- Storage policies for complaint-images
CREATE POLICY "Complaint images publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'complaint-images');
CREATE POLICY "Users can upload complaint images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'complaint-images' AND auth.uid() IS NOT NULL
);

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
