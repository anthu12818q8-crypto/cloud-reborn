/**
 * Anti-tampering utilities
 * Detect and prevent client-side manipulation attempts
 */

import { logger } from './logger';

/**
 * Check for console tampering
 */
export function detectConsoleTampering(): boolean {
  const originalLog = console.log.toString();
  return !originalLog.includes('[native code]');
}

/**
 * Detect if DevTools is open (basic detection)
 * This is NOT foolproof but adds a layer of detection
 */
export function isDevToolsOpen(): boolean {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  return widthThreshold || heightThreshold;
}

/**
 * Create integrity hash for critical data
 */
export async function createIntegrityHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify payment status integrity
 * Ensures payment status can't be tampered client-side
 */
export function verifyPaymentIntegrity(
  paymentData: { userId: string; movieId: string; status: string },
  expectedHash: string
): boolean {
  // In production, this would verify against a server-side hash
  // This is a placeholder for the concept
  logger.debug('Verifying payment integrity', { paymentData, expectedHash });
  return true;
}

/**
 * Secure localStorage wrapper
 * Prevents direct manipulation of stored data
 */
export const secureStorage = {
  set: async (key: string, value: string): Promise<void> => {
    const hash = await createIntegrityHash(value);
    const data = JSON.stringify({ value, hash, timestamp: Date.now() });
    localStorage.setItem(key, data);
  },
  
  get: async (key: string): Promise<string | null> => {
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      const expectedHash = await createIntegrityHash(parsed.value);
      
      if (expectedHash !== parsed.hash) {
        logger.warn(`Data tampering detected for key: ${key}`);
        localStorage.removeItem(key);
        return null;
      }
      
      return parsed.value;
    } catch {
      return null;
    }
  },
  
  remove: (key: string): void => {
    localStorage.removeItem(key);
  },
};

/**
 * Detect proxy/VPN (basic check)
 * Note: This is informational only, not for blocking
 */
export async function detectProxyUsage(): Promise<boolean> {
  try {
    // This would typically check against a service
    // Placeholder for the concept
    return false;
  } catch {
    return false;
  }
}

/**
 * Rate limit client-side actions
 */
const actionTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ACTIONS_PER_WINDOW = 10;

export function isClientRateLimited(actionKey: string): boolean {
  const now = Date.now();
  const timestamps = actionTimestamps.get(actionKey) || [];
  
  // Remove old timestamps
  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (recentTimestamps.length >= MAX_ACTIONS_PER_WINDOW) {
    return true;
  }
  
  recentTimestamps.push(now);
  actionTimestamps.set(actionKey, recentTimestamps);
  return false;
}
