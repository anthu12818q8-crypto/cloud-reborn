import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDeviceFingerprint } from './useDeviceFingerprint';
import { logger } from '@/lib/logger';

export function useBlockCheck() {
  const { deviceInfo } = useDeviceFingerprint();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const checkBlocked = useCallback(async () => {
    if (!deviceInfo?.fingerprint) {
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);

      // Check if device is blocked using the database function
      const { data, error } = await supabase.rpc('is_device_blocked', {
        p_fingerprint: deviceInfo.fingerprint,
      });

      if (error) {
        logger.error('Error checking block status:', error);
        setIsBlocked(false);
        return;
      }

      setIsBlocked(data === true);

      // If blocked, try to get the reason
      if (data === true) {
        const { data: deviceBlock } = await supabase
          .from('blocked_devices')
          .select('reason')
          .eq('fingerprint', deviceInfo.fingerprint)
          .maybeSingle();

        if (deviceBlock?.reason) {
          setBlockReason(deviceBlock.reason);
        }
      }
    } catch (error) {
      logger.error('Error checking block status:', error);
      setIsBlocked(false);
    } finally {
      setIsChecking(false);
    }
  }, [deviceInfo?.fingerprint]);

  useEffect(() => {
    checkBlocked();
  }, [checkBlocked]);

  return { isBlocked, isChecking, blockReason, recheckBlock: checkBlocked };
}
