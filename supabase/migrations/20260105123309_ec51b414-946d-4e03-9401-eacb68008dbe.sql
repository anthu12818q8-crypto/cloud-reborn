-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. FIX: Protect user emails - Only show to authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Users can only view their own profile details
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. FIX: Add INSERT policy for profiles (only own profile)
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. FIX: Add DELETE policy for profiles (GDPR compliance)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- 4. FIX: Secure user_roles table - PREVENT PRIVILEGE ESCALATION
-- Only admins can INSERT roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can UPDATE roles
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can DELETE roles
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Add rate limiting table for brute-force protection
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address inet NOT NULL,
    endpoint text NOT NULL,
    attempt_count integer DEFAULT 1,
    first_attempt_at timestamp with time zone DEFAULT now(),
    last_attempt_at timestamp with time zone DEFAULT now(),
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Index for fast IP lookups
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_ip ON public.auth_rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_blocked ON public.auth_rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Enable RLS on rate limits table
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only backend functions can access rate limits (no public access)
-- No policies = no public access, only service role can access

-- 6. Add security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action ON public.security_audit_log(action, created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON public.security_audit_log(created_at);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_action text,
    p_resource_type text,
    p_resource_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.security_audit_log (user_id, action, resource_type, resource_id, metadata)
    VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_metadata);
END;
$$;

-- 8. Create trigger to log role changes (detect privilege escalation attempts)
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_security_event(
            'ROLE_ASSIGNED',
            'user_roles',
            NEW.user_id::text,
            jsonb_build_object('role', NEW.role, 'assigned_by', auth.uid())
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.log_security_event(
            'ROLE_CHANGED',
            'user_roles',
            NEW.user_id::text,
            jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'changed_by', auth.uid())
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.log_security_event(
            'ROLE_REMOVED',
            'user_roles',
            OLD.user_id::text,
            jsonb_build_object('role', OLD.role, 'removed_by', auth.uid())
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to user_roles table
DROP TRIGGER IF EXISTS trigger_log_role_changes ON public.user_roles;
CREATE TRIGGER trigger_log_role_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_changes();

-- 9. Create function to check suspicious activity
CREATE OR REPLACE FUNCTION public.is_rate_limited(
    p_ip_address inet,
    p_endpoint text,
    p_max_attempts integer DEFAULT 5,
    p_window_minutes integer DEFAULT 15,
    p_block_minutes integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record RECORD;
    v_is_blocked boolean := false;
BEGIN
    -- Check if currently blocked
    SELECT * INTO v_record
    FROM public.auth_rate_limits
    WHERE ip_address = p_ip_address
      AND endpoint = p_endpoint
      AND blocked_until > now()
    LIMIT 1;
    
    IF FOUND THEN
        RETURN true; -- Still blocked
    END IF;
    
    -- Clean up old records and check/update attempt count
    DELETE FROM public.auth_rate_limits
    WHERE ip_address = p_ip_address
      AND endpoint = p_endpoint
      AND first_attempt_at < now() - (p_window_minutes || ' minutes')::interval
      AND (blocked_until IS NULL OR blocked_until < now());
    
    -- Get or create record
    SELECT * INTO v_record
    FROM public.auth_rate_limits
    WHERE ip_address = p_ip_address
      AND endpoint = p_endpoint
      AND first_attempt_at > now() - (p_window_minutes || ' minutes')::interval
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- First attempt in window
        INSERT INTO public.auth_rate_limits (ip_address, endpoint, attempt_count)
        VALUES (p_ip_address, p_endpoint, 1);
        RETURN false;
    ELSE
        -- Increment attempt count
        UPDATE public.auth_rate_limits
        SET attempt_count = attempt_count + 1,
            last_attempt_at = now(),
            blocked_until = CASE 
                WHEN attempt_count + 1 >= p_max_attempts 
                THEN now() + (p_block_minutes || ' minutes')::interval 
                ELSE NULL 
            END
        WHERE id = v_record.id;
        
        RETURN v_record.attempt_count + 1 >= p_max_attempts;
    END IF;
END;
$$;