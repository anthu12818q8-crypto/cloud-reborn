-- Fix RLS policy for device_registrations - restrict to service role only
DROP POLICY IF EXISTS "Service role can manage device registrations" ON public.device_registrations;

-- No public access - only edge functions with service role can access
-- This is handled by not having any policies (RLS enabled but no policies = deny all for anon/authenticated)

-- Same for auth_rate_limits and login_attempts - ensure they're restricted
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.auth_rate_limits;
DROP POLICY IF EXISTS "Service role can manage login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone can read their own attempt status" ON public.login_attempts;