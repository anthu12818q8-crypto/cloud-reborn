// This file is deprecated - use useServerAuth instead
// Keeping for backward compatibility during migration

import { useCallback } from 'react';
import { useServerAuth } from './useServerAuth';

interface AttemptResult {
  blocked: boolean;
  blocked_until?: string;
  remaining_seconds?: number;
  attempt_count: number;
  device_blocked?: boolean;
}

interface AttemptStatus {
  blocked: boolean;
  remaining_seconds?: number;
  attempt_count: number;
}

/**
 * @deprecated Use useServerAuth instead for server-side security
 */
export function useLoginAttempts() {
  const { checkAttempt, recordSuccess, formatBlockTime } = useServerAuth();

  const checkAttemptLegacy = useCallback(async (
    attemptType: 'login' | 'signup' = 'login',
    _maxAttempts: number = 5,
    _blockHours: number = 24
  ): Promise<AttemptResult> => {
    const result = await checkAttempt(attemptType);
    return {
      blocked: result.blocked,
      blocked_until: result.blocked_until,
      remaining_seconds: result.remaining_seconds,
      attempt_count: result.attempt_count ?? 0,
      device_blocked: result.lock_level === 3,
    };
  }, [checkAttempt]);

  const resetAttempts = useCallback(async (attemptType: 'login' | 'signup' = 'login'): Promise<void> => {
    await recordSuccess(attemptType);
  }, [recordSuccess]);

  const getAttemptStatus = useCallback(async (_attemptType: 'login' | 'signup' = 'login'): Promise<AttemptStatus> => {
    // For status check, we don't want to record an attempt
    // So we'll return a default non-blocked state
    // The actual check happens during checkAttempt
    return {
      blocked: false,
      attempt_count: 0,
    };
  }, []);

  return {
    checkAttempt: checkAttemptLegacy,
    resetAttempts,
    getAttemptStatus,
    formatBlockTime,
  };
}
