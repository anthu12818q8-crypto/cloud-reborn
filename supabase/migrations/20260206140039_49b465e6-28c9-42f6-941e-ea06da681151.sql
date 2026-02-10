-- Drop existing functions to recreate with new logic
DROP FUNCTION IF EXISTS public.check_login_attempt(text, inet, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_attempt_status(text, text);
DROP FUNCTION IF EXISTS public.reset_login_attempts(text, text);

-- Add new columns to login_attempts for progressive lockout
ALTER TABLE public.login_attempts 
ADD COLUMN IF NOT EXISTS lock_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_violations integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_violation_date date DEFAULT CURRENT_DATE;

-- Create device_registrations table to track accounts per device
CREATE TABLE IF NOT EXISTS public.device_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_hash text NOT NULL,
    user_id uuid NOT NULL,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(device_hash, user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_device_registrations_hash ON public.device_registrations(device_hash);
CREATE INDEX IF NOT EXISTS idx_device_registrations_date ON public.device_registrations(created_at);

-- Enable RLS
ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;

-- RLS policies - only service role can access
CREATE POLICY "Service role can manage device registrations"
ON public.device_registrations
FOR ALL
USING (true)
WITH CHECK (true);

-- Server-side progressive lockout function
CREATE OR REPLACE FUNCTION public.server_check_auth_attempt(
    p_device_hash text,
    p_ip_address inet DEFAULT NULL,
    p_attempt_type text DEFAULT 'login',
    p_is_success boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record RECORD;
    v_now timestamp with time zone := now();
    v_today date := CURRENT_DATE;
    v_lock_minutes integer;
    v_max_attempts integer;
    v_should_lock boolean := false;
    v_new_lock_level integer;
BEGIN
    -- Set max attempts based on type
    IF p_attempt_type = 'signup' THEN
        v_max_attempts := 3;
    ELSE
        v_max_attempts := 5;
    END IF;

    -- Get existing record
    SELECT * INTO v_record
    FROM public.login_attempts
    WHERE fingerprint = p_device_hash
      AND attempt_type = p_attempt_type
    LIMIT 1;

    -- If successful attempt, reset attempts
    IF p_is_success THEN
        IF FOUND THEN
            DELETE FROM public.login_attempts 
            WHERE fingerprint = p_device_hash AND attempt_type = p_attempt_type;
        END IF;
        RETURN jsonb_build_object('blocked', false, 'success', true);
    END IF;

    -- Check if currently blocked
    IF FOUND AND v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
        RETURN jsonb_build_object(
            'blocked', true,
            'blocked_until', v_record.blocked_until,
            'remaining_seconds', EXTRACT(EPOCH FROM (v_record.blocked_until - v_now))::integer,
            'attempt_count', v_record.attempt_count,
            'lock_level', v_record.lock_level,
            'reason', 'device_locked'
        );
    END IF;

    -- Check if we need to reset (24h passed since last violation)
    IF FOUND AND v_record.last_violation_date < v_today - interval '1 day' THEN
        -- Reset the record
        UPDATE public.login_attempts
        SET attempt_count = 0,
            lock_level = 0,
            blocked_until = NULL,
            last_violation_date = v_today
        WHERE fingerprint = p_device_hash AND attempt_type = p_attempt_type;
        
        SELECT * INTO v_record
        FROM public.login_attempts
        WHERE fingerprint = p_device_hash AND attempt_type = p_attempt_type;
    END IF;

    IF NOT FOUND THEN
        -- First attempt
        INSERT INTO public.login_attempts (
            fingerprint, ip_address, attempt_type, attempt_count, 
            lock_level, total_violations, last_violation_date
        )
        VALUES (p_device_hash, p_ip_address, p_attempt_type, 1, 0, 1, v_today);
        
        RETURN jsonb_build_object(
            'blocked', false,
            'attempt_count', 1,
            'max_attempts', v_max_attempts,
            'attempts_remaining', v_max_attempts - 1
        );
    ELSE
        -- Increment attempt count
        v_record.attempt_count := v_record.attempt_count + 1;
        v_record.total_violations := v_record.total_violations + 1;
        
        -- Progressive lockout logic
        IF p_attempt_type = 'login' THEN
            IF v_record.attempt_count >= 5 THEN
                v_new_lock_level := 3;
                v_lock_minutes := 1440; -- 24 hours
                v_should_lock := true;
            ELSIF v_record.attempt_count >= 4 THEN
                v_new_lock_level := 2;
                v_lock_minutes := 30;
                v_should_lock := true;
            ELSIF v_record.attempt_count >= 3 THEN
                v_new_lock_level := 1;
                v_lock_minutes := 15;
                v_should_lock := true;
            END IF;
        ELSE
            -- Signup: 3 attempts = 24h lock
            IF v_record.attempt_count >= 3 THEN
                v_new_lock_level := 3;
                v_lock_minutes := 1440;
                v_should_lock := true;
            END IF;
        END IF;

        UPDATE public.login_attempts
        SET attempt_count = v_record.attempt_count,
            last_attempt_at = v_now,
            ip_address = COALESCE(p_ip_address, ip_address),
            total_violations = v_record.total_violations,
            last_violation_date = v_today,
            lock_level = CASE WHEN v_should_lock THEN v_new_lock_level ELSE lock_level END,
            blocked_until = CASE WHEN v_should_lock THEN v_now + (v_lock_minutes || ' minutes')::interval ELSE NULL END
        WHERE fingerprint = p_device_hash AND attempt_type = p_attempt_type;

        IF v_should_lock THEN
            RETURN jsonb_build_object(
                'blocked', true,
                'blocked_until', v_now + (v_lock_minutes || ' minutes')::interval,
                'remaining_seconds', v_lock_minutes * 60,
                'attempt_count', v_record.attempt_count,
                'lock_level', v_new_lock_level,
                'lock_duration_minutes', v_lock_minutes,
                'reason', 'progressive_lock'
            );
        END IF;

        RETURN jsonb_build_object(
            'blocked', false,
            'attempt_count', v_record.attempt_count,
            'max_attempts', v_max_attempts,
            'attempts_remaining', v_max_attempts - v_record.attempt_count
        );
    END IF;
END;
$$;

-- Check device registration limit
CREATE OR REPLACE FUNCTION public.check_device_registration_limit(
    p_device_hash text,
    p_max_accounts integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_count integer;
    v_recent_count integer;
BEGIN
    -- Count total accounts from this device
    SELECT COUNT(*) INTO v_count
    FROM public.device_registrations
    WHERE device_hash = p_device_hash;

    -- Count accounts created in last 24 hours
    SELECT COUNT(*) INTO v_recent_count
    FROM public.device_registrations
    WHERE device_hash = p_device_hash
      AND created_at > now() - interval '24 hours';

    IF v_count >= p_max_accounts THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'max_accounts_reached',
            'current_count', v_count,
            'max_allowed', p_max_accounts
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'current_count', v_count,
        'max_allowed', p_max_accounts
    );
END;
$$;

-- Register device for new account
CREATE OR REPLACE FUNCTION public.register_device_account(
    p_device_hash text,
    p_user_id uuid,
    p_ip_address inet DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.device_registrations (device_hash, user_id, ip_address)
    VALUES (p_device_hash, p_user_id, p_ip_address)
    ON CONFLICT (device_hash, user_id) DO NOTHING;
END;
$$;

-- Detect suspicious behavior
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
    p_device_hash text,
    p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_login_attempts integer;
    v_signup_attempts integer;
    v_is_blocked boolean;
    v_suspicious_score integer := 0;
BEGIN
    -- Check permanent device block
    SELECT true INTO v_is_blocked
    FROM public.blocked_devices
    WHERE fingerprint = p_device_hash;
    
    IF v_is_blocked THEN
        RETURN jsonb_build_object(
            'suspicious', true,
            'blocked', true,
            'reason', 'device_permanently_blocked'
        );
    END IF;

    -- Check IP block
    IF p_ip_address IS NOT NULL THEN
        SELECT true INTO v_is_blocked
        FROM public.blocked_ips
        WHERE ip_address = p_ip_address;
        
        IF v_is_blocked THEN
            RETURN jsonb_build_object(
                'suspicious', true,
                'blocked', true,
                'reason', 'ip_blocked'
            );
        END IF;
    END IF;

    -- Count recent login attempts from device
    SELECT COALESCE(SUM(total_violations), 0) INTO v_login_attempts
    FROM public.login_attempts
    WHERE fingerprint = p_device_hash
      AND created_at > now() - interval '24 hours';

    -- Score based on violations
    IF v_login_attempts > 10 THEN
        v_suspicious_score := v_suspicious_score + 50;
    ELSIF v_login_attempts > 5 THEN
        v_suspicious_score := v_suspicious_score + 25;
    END IF;

    RETURN jsonb_build_object(
        'suspicious', v_suspicious_score >= 50,
        'blocked', false,
        'score', v_suspicious_score,
        'violations_24h', v_login_attempts
    );
END;
$$;