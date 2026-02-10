import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedDeviceSignals, DeviceSignals } from '@/lib/deviceSignals';

interface AuthSecurityResponse {
  blocked: boolean;
  blocked_until?: string;
  remaining_seconds?: number;
  attempt_count?: number;
  lock_level?: number;
  lock_duration_minutes?: number;
  max_attempts?: number;
  attempts_remaining?: number;
  reason?: string;
  allowed?: boolean;
  current_count?: number;
  max_allowed?: number;
  suspicious?: boolean;
  score?: number;
  success?: boolean;
}

interface UseServerAuthResult {
  checkAttempt: (attemptType: 'login' | 'signup') => Promise<AuthSecurityResponse>;
  recordSuccess: (attemptType: 'login' | 'signup', userId?: string) => Promise<void>;
  checkRegistrationLimit: () => Promise<{ allowed: boolean; currentCount: number; maxAllowed: number }>;
  detectSuspicious: () => Promise<{ suspicious: boolean; blocked: boolean; reason?: string }>;
  formatBlockTime: (seconds: number) => string;
  isLoading: boolean;
  error: string | null;
}

export function useServerAuth(): UseServerAuthResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAuthSecurity = useCallback(async (
    action: string,
    attemptType?: 'login' | 'signup',
    userId?: string
  ): Promise<AuthSecurityResponse> => {
    const signals = await getCachedDeviceSignals();
    
    const response = await supabase.functions.invoke('auth-security', {
      body: {
        action,
        attemptType,
        userId,
        signals,
      },
    });

    if (response.error) {
      throw new Error(response.error.message || 'Security check failed');
    }

    return response.data;
  }, []);

  const checkAttempt = useCallback(async (attemptType: 'login' | 'signup'): Promise<AuthSecurityResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await callAuthSecurity('check_attempt', attemptType);
      return result;
    } catch (err: any) {
      setError(err.message);
      // Return a blocked state on error to prevent bypass
      return { blocked: true, reason: 'security_error' };
    } finally {
      setIsLoading(false);
    }
  }, [callAuthSecurity]);

  const recordSuccess = useCallback(async (attemptType: 'login' | 'signup', userId?: string): Promise<void> => {
    try {
      await callAuthSecurity('record_success', attemptType, userId);
    } catch (err) {
      // Log but don't block on success recording failure
      console.error('Failed to record auth success:', err);
    }
  }, [callAuthSecurity]);

  const checkRegistrationLimit = useCallback(async (): Promise<{ allowed: boolean; currentCount: number; maxAllowed: number }> => {
    setIsLoading(true);
    try {
      const result = await callAuthSecurity('check_registration');
      return {
        allowed: result.allowed ?? false,
        currentCount: result.current_count ?? 0,
        maxAllowed: result.max_allowed ?? 3,
      };
    } catch (err: any) {
      setError(err.message);
      return { allowed: false, currentCount: 3, maxAllowed: 3 };
    } finally {
      setIsLoading(false);
    }
  }, [callAuthSecurity]);

  const detectSuspicious = useCallback(async (): Promise<{ suspicious: boolean; blocked: boolean; reason?: string }> => {
    try {
      const result = await callAuthSecurity('detect_suspicious');
      return {
        suspicious: result.suspicious ?? false,
        blocked: result.blocked ?? false,
        reason: result.reason,
      };
    } catch (err) {
      return { suspicious: false, blocked: false };
    }
  }, [callAuthSecurity]);

  const formatBlockTime = useCallback((seconds: number): string => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours} giờ ${mins} phút`;
    }
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins} phút ${secs} giây`;
    }
    return `${seconds} giây`;
  }, []);

  return {
    checkAttempt,
    recordSuccess,
    checkRegistrationLimit,
    detectSuspicious,
    formatBlockTime,
    isLoading,
    error,
  };
}
