import { useState, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface DeviceInfo {
  fingerprint: string;
  ip: string | null;
  userAgent: string;
}

let cachedFingerprint: string | null = null;
let cachedIp: string | null = null;

export function useDeviceFingerprint() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        // Get fingerprint
        let fingerprint = cachedFingerprint;
        if (!fingerprint) {
          const fp = await FingerprintJS.load();
          const result = await fp.get();
          fingerprint = result.visitorId;
          cachedFingerprint = fingerprint;
        }

        // Get IP address (using free API)
        let ip = cachedIp;
        if (!ip) {
          try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ip = data.ip;
            cachedIp = ip;
          } catch (error) {
            console.error('Failed to get IP:', error);
            ip = null;
          }
        }

        setDeviceInfo({
          fingerprint,
          ip,
          userAgent: navigator.userAgent,
        });
      } catch (error) {
        console.error('Failed to get device fingerprint:', error);
        // Fallback fingerprint using available data
        const fallbackFp = btoa(
          navigator.userAgent +
          screen.width +
          screen.height +
          navigator.language +
          new Date().getTimezoneOffset()
        ).slice(0, 32);
        
        setDeviceInfo({
          fingerprint: fallbackFp,
          ip: null,
          userAgent: navigator.userAgent,
        });
      } finally {
        setIsLoading(false);
      }
    };

    getDeviceInfo();
  }, []);

  const clearCache = () => {
    cachedFingerprint = null;
    cachedIp = null;
  };

  return { deviceInfo, isLoading, clearCache };
}

// Utility function to get device info synchronously if cached
export function getDeviceFingerprint(): string | null {
  return cachedFingerprint;
}

export function getDeviceIp(): string | null {
  return cachedIp;
}
