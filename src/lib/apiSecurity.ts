/**
 * API Security utilities
 * Helps prevent API key exposure and adds obfuscation layers
 */

// Obfuscate sensitive data in localStorage
const STORAGE_PREFIX = '_lv_';

/**
 * Store sensitive data with obfuscation
 */
export function secureStore(key: string, value: string): void {
  const obfuscated = btoa(value);
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, obfuscated);
}

/**
 * Retrieve obfuscated data
 */
export function secureRetrieve(key: string): string | null {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  if (!stored) return null;
  try {
    return atob(stored);
  } catch {
    return null;
  }
}

/**
 * Clear sensitive data
 */
export function secureClear(key: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

/**
 * Mask sensitive strings for logging (shows first and last 4 chars)
 */
export function maskSensitive(value: string): string {
  if (!value || value.length < 12) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Sanitize headers before logging - removes or masks sensitive headers
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveKeys = ['authorization', 'apikey', 'x-api-key', 'cookie', 'set-cookie'];
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Block common API key extraction techniques
 */
export function initializeApiProtection(): void {
  if (import.meta.env.DEV) return;
  
  // Override console methods to filter sensitive data
  const sensitivePatterns = [
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT tokens
    /Bearer\s+[A-Za-z0-9_-]+/gi, // Bearer tokens
    /apikey[:\s]+[A-Za-z0-9_-]+/gi, // API keys
  ];
  
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  
  const filterSensitive = (args: unknown[]): unknown[] => {
    return args.map(arg => {
      if (typeof arg === 'string') {
        let filtered = arg;
        for (const pattern of sensitivePatterns) {
          filtered = filtered.replace(pattern, '[REDACTED]');
        }
        return filtered;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          let str = JSON.stringify(arg);
          for (const pattern of sensitivePatterns) {
            str = str.replace(pattern, '[REDACTED]');
          }
          return JSON.parse(str);
        } catch {
          return arg;
        }
      }
      return arg;
    });
  };
  
  console.log = (...args) => originalConsoleLog(...filterSensitive(args));
  console.info = (...args) => originalConsoleInfo(...filterSensitive(args));
  console.warn = (...args) => originalConsoleWarn(...filterSensitive(args));
  
  // Block window.fetch override attempts
  Object.defineProperty(window, 'fetch', {
    writable: false,
    configurable: false,
  });
  
  // Block XMLHttpRequest prototype modifications
  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  const xhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  
  Object.defineProperty(XMLHttpRequest.prototype, 'open', {
    value: xhrOpen,
    writable: false,
    configurable: false,
  });
  
  Object.defineProperty(XMLHttpRequest.prototype, 'send', {
    value: xhrSend,
    writable: false,
    configurable: false,
  });
  
  Object.defineProperty(XMLHttpRequest.prototype, 'setRequestHeader', {
    value: xhrSetHeader,
    writable: false,
    configurable: false,
  });
}

/**
 * Detect if someone is trying to intercept network requests
 */
export function detectNetworkInterception(): boolean {
  // Check if fetch has been modified
  const originalFetch = window.fetch.toString();
  if (!originalFetch.includes('[native code]')) {
    return true;
  }
  
  // Check if XMLHttpRequest has been modified
  const originalXhr = XMLHttpRequest.prototype.open.toString();
  if (!originalXhr.includes('[native code]')) {
    return true;
  }
  
  return false;
}

/**
 * Security information for API keys
 * 
 * IMPORTANT NOTES:
 * 
 * 1. VITE_SUPABASE_PUBLISHABLE_KEY (anon key):
 *    - This is a PUBLIC key, designed to be exposed in client-side code
 *    - It has LIMITED permissions controlled by RLS policies
 *    - It CANNOT perform admin operations
 *    - It's SAFE to be visible in Network tab
 * 
 * 2. SUPABASE_SERVICE_ROLE_KEY:
 *    - This is a SECRET key, NEVER exposed to client
 *    - Only used in Edge Functions (server-side)
 *    - Has FULL admin access
 *    - NEVER hardcode this in client code
 * 
 * 3. Best Practices:
 *    - All sensitive operations go through Edge Functions
 *    - RLS policies protect data at database level
 *    - JWT tokens authenticate users, not the anon key
 *    - Service role key stays in Deno.env (server only)
 */
