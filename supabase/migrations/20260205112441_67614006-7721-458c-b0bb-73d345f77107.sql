-- Create login_attempts table to track failed logins per device
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint text NOT NULL,
  ip_address inet,
  attempt_type text NOT NULL DEFAULT 'login', -- 'login', 'signup'
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  blocked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique index for fingerprint + attempt_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_attempts_fingerprint_type 
  ON public.login_attempts (fingerprint, attempt_type);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked_until 
  ON public.login_attempts (blocked_until) 
  WHERE blocked_until IS NOT NULL;

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can manage login attempts (security sensitive)
CREATE POLICY "Service role can manage login attempts"
  ON public.login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anonymous to check their own block status
CREATE POLICY "Anyone can read their own attempt status"
  ON public.login_attempts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create function to check and increment login attempts
CREATE OR REPLACE FUNCTION public.check_login_attempt(
  p_fingerprint text,
  p_ip_address inet DEFAULT NULL,
  p_attempt_type text DEFAULT 'login',
  p_max_attempts integer DEFAULT 5,
  p_block_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record RECORD;
  v_now timestamp with time zone := now();
  v_block_until timestamp with time zone;
  v_should_block boolean := false;
BEGIN
  -- Check if currently blocked
  SELECT * INTO v_record
  FROM public.login_attempts
  WHERE fingerprint = p_fingerprint
    AND attempt_type = p_attempt_type
    AND blocked_until > v_now
  LIMIT 1;
  
  IF FOUND THEN
    -- Still blocked
    RETURN jsonb_build_object(
      'blocked', true,
      'blocked_until', v_record.blocked_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_record.blocked_until - v_now))::integer,
      'attempt_count', v_record.attempt_count
    );
  END IF;
  
  -- Get or create record
  SELECT * INTO v_record
  FROM public.login_attempts
  WHERE fingerprint = p_fingerprint
    AND attempt_type = p_attempt_type
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- First attempt
    INSERT INTO public.login_attempts (fingerprint, ip_address, attempt_type, attempt_count)
    VALUES (p_fingerprint, p_ip_address, p_attempt_type, 1);
    
    RETURN jsonb_build_object(
      'blocked', false,
      'attempt_count', 1,
      'max_attempts', p_max_attempts
    );
  ELSE
    -- Increment attempt count
    v_record.attempt_count := v_record.attempt_count + 1;
    
    -- Check if should block
    IF v_record.attempt_count >= p_max_attempts THEN
      v_should_block := true;
      v_block_until := v_now + (p_block_hours || ' hours')::interval;
    END IF;
    
    UPDATE public.login_attempts
    SET attempt_count = v_record.attempt_count,
        last_attempt_at = v_now,
        ip_address = COALESCE(p_ip_address, ip_address),
        blocked_until = v_block_until
    WHERE fingerprint = p_fingerprint
      AND attempt_type = p_attempt_type;
    
    IF v_should_block THEN
      -- Also add to blocked_devices for persistent block
      INSERT INTO public.blocked_devices (fingerprint, ip_address, reason, blocked_by)
      VALUES (
        p_fingerprint, 
        p_ip_address, 
        'Tự động khoá do ' || p_attempt_type || ' thất bại ' || p_max_attempts || ' lần',
        NULL
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        reason = EXCLUDED.reason,
        created_at = now();
      
      RETURN jsonb_build_object(
        'blocked', true,
        'blocked_until', v_block_until,
        'remaining_seconds', EXTRACT(EPOCH FROM (v_block_until - v_now))::integer,
        'attempt_count', v_record.attempt_count,
        'device_blocked', true
      );
    END IF;
    
    RETURN jsonb_build_object(
      'blocked', false,
      'attempt_count', v_record.attempt_count,
      'max_attempts', p_max_attempts,
      'attempts_remaining', p_max_attempts - v_record.attempt_count
    );
  END IF;
END;
$$;

-- Create function to reset login attempts on success
CREATE OR REPLACE FUNCTION public.reset_login_attempts(
  p_fingerprint text,
  p_attempt_type text DEFAULT 'login'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE fingerprint = p_fingerprint
    AND attempt_type = p_attempt_type;
END;
$$;

-- Create function to get attempt status
CREATE OR REPLACE FUNCTION public.get_attempt_status(
  p_fingerprint text,
  p_attempt_type text DEFAULT 'login'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_record RECORD;
  v_now timestamp with time zone := now();
BEGIN
  SELECT * INTO v_record
  FROM public.login_attempts
  WHERE fingerprint = p_fingerprint
    AND attempt_type = p_attempt_type
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('blocked', false, 'attempt_count', 0);
  END IF;
  
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'blocked_until', v_record.blocked_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_record.blocked_until - v_now))::integer,
      'attempt_count', v_record.attempt_count
    );
  END IF;
  
  RETURN jsonb_build_object(
    'blocked', false,
    'attempt_count', v_record.attempt_count
  );
END;
$$;

-- Cleanup old login attempts (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete attempts older than 7 days that are not blocked
  DELETE FROM public.login_attempts
  WHERE created_at < now() - interval '7 days'
    AND (blocked_until IS NULL OR blocked_until < now());
END;
$$;