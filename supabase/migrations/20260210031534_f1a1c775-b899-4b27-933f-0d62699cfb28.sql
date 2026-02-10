
-- ============================================
-- 1. detect_suspicious_activity
-- ============================================
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
  p_device_hash TEXT,
  p_ip_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_blocked BOOLEAN := false;
  v_reason TEXT := null;
  v_suspicious BOOLEAN := false;
  v_score INT := 0;
BEGIN
  -- Check if device hash is in blocked_devices
  SELECT EXISTS(
    SELECT 1 FROM public.blocked_devices WHERE fingerprint = p_device_hash
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RETURN jsonb_build_object('blocked', true, 'suspicious', true, 'reason', 'device_blocked', 'score', 100);
  END IF;

  -- Check if IP is blocked
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM public.blocked_ips WHERE ip_address = p_ip_address::inet
    ) INTO v_is_blocked;
  EXCEPTION WHEN OTHERS THEN
    v_is_blocked := false;
  END;

  IF v_is_blocked THEN
    RETURN jsonb_build_object('blocked', true, 'suspicious', true, 'reason', 'ip_blocked', 'score', 100);
  END IF;

  -- Check login_attempts for high violation count
  SELECT COALESCE(SUM(total_violations), 0) INTO v_score
  FROM public.login_attempts
  WHERE fingerprint = p_device_hash;

  IF v_score >= 10 THEN
    v_suspicious := true;
    v_reason := 'high_violations';
  END IF;

  RETURN jsonb_build_object('blocked', false, 'suspicious', v_suspicious, 'reason', v_reason, 'score', v_score);
END;
$$;

-- ============================================
-- 2. server_check_auth_attempt
-- ============================================
CREATE OR REPLACE FUNCTION public.server_check_auth_attempt(
  p_device_hash TEXT,
  p_ip_address TEXT,
  p_attempt_type TEXT,
  p_is_success BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_max_attempts INT;
  v_lock_minutes INT;
  v_new_lock_level INT;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  -- Set max attempts based on type
  IF p_attempt_type = 'login' THEN
    v_max_attempts := 5;
  ELSE
    v_max_attempts := 3;
  END IF;

  -- Get or create attempt record
  SELECT * INTO v_record FROM public.login_attempts
  WHERE fingerprint = p_device_hash AND attempt_type = p_attempt_type;

  IF v_record IS NULL THEN
    IF p_is_success THEN
      RETURN jsonb_build_object('blocked', false, 'attempt_count', 0, 'lock_level', 0);
    END IF;

    INSERT INTO public.login_attempts (fingerprint, ip_address, attempt_count, lock_level, attempt_type, last_attempt_at, total_violations)
    VALUES (p_device_hash, p_ip_address::inet, 1, 0, p_attempt_type, now(), 0)
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
      'blocked', false,
      'attempt_count', 1,
      'lock_level', 0,
      'attempts_remaining', v_max_attempts - 1
    );
  END IF;

  -- If success, reset attempts
  IF p_is_success THEN
    UPDATE public.login_attempts
    SET attempt_count = 0, blocked_until = NULL
    WHERE id = v_record.id;

    RETURN jsonb_build_object('blocked', false, 'attempt_count', 0, 'lock_level', v_record.lock_level);
  END IF;

  -- Check if currently blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > now() THEN
    RETURN jsonb_build_object(
      'blocked', true,
      'blocked_until', v_record.blocked_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_record.blocked_until - now()))::int,
      'attempt_count', v_record.attempt_count,
      'lock_level', v_record.lock_level
    );
  END IF;

  -- Increment attempt count
  UPDATE public.login_attempts
  SET attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      ip_address = p_ip_address::inet
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  -- Check if reached max attempts
  IF v_record.attempt_count >= v_max_attempts THEN
    v_new_lock_level := COALESCE(v_record.lock_level, 0) + 1;
    IF v_new_lock_level > 3 THEN v_new_lock_level := 3; END IF;

    CASE v_new_lock_level
      WHEN 1 THEN v_lock_minutes := 15;
      WHEN 2 THEN v_lock_minutes := 30;
      ELSE v_lock_minutes := 1440; -- 24 hours
    END CASE;

    v_blocked_until := now() + (v_lock_minutes || ' minutes')::interval;

    UPDATE public.login_attempts
    SET lock_level = v_new_lock_level,
        blocked_until = v_blocked_until,
        total_violations = COALESCE(total_violations, 0) + 1,
        attempt_count = 0
    WHERE id = v_record.id;

    RETURN jsonb_build_object(
      'blocked', true,
      'blocked_until', v_blocked_until,
      'remaining_seconds', v_lock_minutes * 60,
      'attempt_count', v_max_attempts,
      'lock_level', v_new_lock_level,
      'lock_duration_minutes', v_lock_minutes,
      'max_attempts', v_max_attempts
    );
  END IF;

  RETURN jsonb_build_object(
    'blocked', false,
    'attempt_count', v_record.attempt_count,
    'lock_level', v_record.lock_level,
    'attempts_remaining', v_max_attempts - v_record.attempt_count,
    'max_attempts', v_max_attempts
  );
END;
$$;

-- ============================================
-- 3. check_device_registration_limit
-- ============================================
CREATE OR REPLACE FUNCTION public.check_device_registration_limit(
  p_device_hash TEXT,
  p_max_accounts INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.user_device_info
  WHERE fingerprint = p_device_hash;

  RETURN jsonb_build_object(
    'allowed', v_count < p_max_accounts,
    'current_count', v_count,
    'max_allowed', p_max_accounts
  );
END;
$$;

-- ============================================
-- 4. register_device_account
-- ============================================
CREATE OR REPLACE FUNCTION public.register_device_account(
  p_device_hash TEXT,
  p_user_id UUID,
  p_ip_address TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_device_info (user_id, fingerprint, ip_address, last_seen_at)
  VALUES (p_user_id, p_device_hash, p_ip_address::inet, now())
  ON CONFLICT (user_id, fingerprint) DO UPDATE
  SET ip_address = p_ip_address::inet, last_seen_at = now();
END;
$$;
