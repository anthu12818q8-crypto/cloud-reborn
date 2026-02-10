-- Fix 1: Add RLS policies to auth_rate_limits table
-- This table should only be accessed by the system via security definer functions

-- Allow the database function to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.auth_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix 2: Make notifications INSERT policy more restrictive
-- Only allow system/authenticated users to insert notifications for other users
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix 3: Add explicit deny for anonymous on profiles
-- Ensure anonymous users cannot access profiles
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Fix 4: Add explicit deny for anonymous on user_device_info
CREATE POLICY "Block anonymous access to device info"
ON public.user_device_info
FOR SELECT
TO anon
USING (false);

-- Fix 5: Add security audit logging for payment operations
CREATE OR REPLACE FUNCTION public.log_payment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_security_event(
            'PAYMENT_REQUEST_CREATED',
            'payment_requests',
            NEW.id::text,
            jsonb_build_object('user_id', NEW.user_id, 'movie_id', NEW.movie_id, 'amount', NEW.amount)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            PERFORM public.log_security_event(
                'PAYMENT_STATUS_CHANGED',
                'payment_requests',
                NEW.id::text,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'admin_id', NEW.admin_id)
            );
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for payment logging
DROP TRIGGER IF EXISTS log_payment_changes_trigger ON public.payment_requests;
CREATE TRIGGER log_payment_changes_trigger
AFTER INSERT OR UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_changes();

-- Fix 6: Add security audit logging for blocked devices
CREATE OR REPLACE FUNCTION public.log_block_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_security_event(
            'DEVICE_BLOCKED',
            'blocked_devices',
            NEW.id::text,
            jsonb_build_object('fingerprint', NEW.fingerprint, 'reason', NEW.reason, 'blocked_by', NEW.blocked_by)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.log_security_event(
            'DEVICE_UNBLOCKED',
            'blocked_devices',
            OLD.id::text,
            jsonb_build_object('fingerprint', OLD.fingerprint, 'unblocked_by', auth.uid())
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for block logging
DROP TRIGGER IF EXISTS log_block_changes_trigger ON public.blocked_devices;
CREATE TRIGGER log_block_changes_trigger
AFTER INSERT OR DELETE ON public.blocked_devices
FOR EACH ROW
EXECUTE FUNCTION public.log_block_changes();

-- Fix 7: Add function to verify video access server-side
CREATE OR REPLACE FUNCTION public.can_access_movie(p_movie_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_requires_payment boolean;
    v_user_id uuid;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check if movie requires payment
    SELECT requires_payment INTO v_requires_payment
    FROM public.movies
    WHERE id = p_movie_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- If no payment required, allow access
    IF NOT v_requires_payment THEN
        RETURN true;
    END IF;
    
    -- Check if user has paid
    RETURN public.has_paid_for_movie(v_user_id, p_movie_id);
END;
$$;