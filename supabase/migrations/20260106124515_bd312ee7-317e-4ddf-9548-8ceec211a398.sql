-- =====================================================
-- USER MANAGEMENT & PAYMENT SYSTEM
-- =====================================================

-- 1. Create blocked_devices table for device fingerprinting
CREATE TABLE public.blocked_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint text NOT NULL UNIQUE,
    ip_address inet,
    blocked_by uuid REFERENCES auth.users(id),
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_devices ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked devices
CREATE POLICY "Admins can view blocked devices"
ON public.blocked_devices FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert blocked devices"
ON public.blocked_devices FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete blocked devices"
ON public.blocked_devices FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Create blocked_ips table for strict IP blocking
CREATE TABLE public.blocked_ips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address inet NOT NULL UNIQUE,
    blocked_by uuid REFERENCES auth.users(id),
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view blocked ips"
ON public.blocked_ips FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert blocked ips"
ON public.blocked_ips FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete blocked ips"
ON public.blocked_ips FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add payment fields to movies table
ALTER TABLE public.movies 
ADD COLUMN IF NOT EXISTS requires_payment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_amount decimal(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_image_url text;

-- 4. Create payment_requests table
CREATE TABLE public.payment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    movie_id uuid REFERENCES public.movies(id) ON DELETE CASCADE NOT NULL,
    amount decimal(10,2) NOT NULL,
    proof_image_url text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_id uuid REFERENCES auth.users(id),
    admin_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, movie_id)
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment requests
CREATE POLICY "Users can view their own payment requests"
ON public.payment_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own payment requests
CREATE POLICY "Users can create payment requests"
ON public.payment_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all payment requests
CREATE POLICY "Admins can view all payment requests"
ON public.payment_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update payment requests (approve/reject)
CREATE POLICY "Admins can update payment requests"
ON public.payment_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create user_device_info table for tracking
CREATE TABLE public.user_device_info (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fingerprint text NOT NULL,
    ip_address inet,
    user_agent text,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, fingerprint)
);

ALTER TABLE public.user_device_info ENABLE ROW LEVEL SECURITY;

-- Users can insert their own device info
CREATE POLICY "Users can insert device info"
ON public.user_device_info FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own device info
CREATE POLICY "Users can update device info"
ON public.user_device_info FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all device info
CREATE POLICY "Admins can view all device info"
ON public.user_device_info FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment proofs
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs' AND has_role(auth.uid(), 'admin'::app_role));

-- 7. Create function to check if device/IP is blocked
CREATE OR REPLACE FUNCTION public.is_device_blocked(p_fingerprint text, p_ip_address inet DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check fingerprint
    IF EXISTS (SELECT 1 FROM public.blocked_devices WHERE fingerprint = p_fingerprint) THEN
        RETURN true;
    END IF;
    
    -- Check IP if provided
    IF p_ip_address IS NOT NULL AND EXISTS (SELECT 1 FROM public.blocked_ips WHERE ip_address = p_ip_address) THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- 8. Create function to check if user has paid for movie
CREATE OR REPLACE FUNCTION public.has_paid_for_movie(p_user_id uuid, p_movie_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.payment_requests
        WHERE user_id = p_user_id
        AND movie_id = p_movie_id
        AND status = 'approved'
    )
$$;

-- 9. Update trigger for payment_requests
CREATE TRIGGER update_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Index for performance
CREATE INDEX idx_blocked_devices_fingerprint ON public.blocked_devices(fingerprint);
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX idx_payment_requests_user_movie ON public.payment_requests(user_id, movie_id);
CREATE INDEX idx_user_device_info_fingerprint ON public.user_device_info(fingerprint);