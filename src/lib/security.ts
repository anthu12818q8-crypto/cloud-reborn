/**
 * Security utilities for the application
 * Implements Defense in Depth principles
 */

import { z } from 'zod';

// ========================
// INPUT VALIDATION SCHEMAS
// ========================

export const emailSchema = z
  .string()
  .trim()
  .email({ message: 'Email không hợp lệ' })
  .max(255, { message: 'Email không được quá 255 ký tự' });

export const passwordSchema = z
  .string()
  .min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  .max(128, { message: 'Mật khẩu không được quá 128 ký tự' })
  .regex(/[A-Z]/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa' })
  .regex(/[a-z]/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ thường' })
  .regex(/[0-9]/, { message: 'Mật khẩu phải chứa ít nhất 1 số' })
  .regex(/[^A-Za-z0-9]/, { message: 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt' });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  .max(100, { message: 'Tên không được quá 100 ký tự' })
  .regex(/^[a-zA-ZÀ-ỹ\s]+$/, { message: 'Tên chỉ được chứa chữ cái và khoảng trắng' });

export const movieTitleSchema = z
  .string()
  .trim()
  .min(1, { message: 'Tiêu đề không được để trống' })
  .max(200, { message: 'Tiêu đề không được quá 200 ký tự' });

export const movieDescriptionSchema = z
  .string()
  .trim()
  .max(5000, { message: 'Mô tả không được quá 5000 ký tự' })
  .optional();

export const commentSchema = z
  .string()
  .trim()
  .min(1, { message: 'Bình luận không được để trống' })
  .max(2000, { message: 'Bình luận không được quá 2000 ký tự' });

// ========================
// SANITIZATION FUNCTIONS
// ========================

/**
 * Sanitize user input to prevent XSS attacks
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize HTML content - strips all HTML tags
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Encode string for safe use in URLs
 */
export function safeEncodeURIComponent(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

// ========================
// RATE LIMITING (Client-side)
// ========================

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Check if an action is rate limited (client-side check)
 * Server-side rate limiting is also implemented in the database
 */
export function isRateLimited(actionKey: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(actionKey);

  if (!entry) {
    rateLimitStore.set(actionKey, {
      count: 1,
      firstAttempt: now,
      blockedUntil: null,
    });
    return false;
  }

  // Check if currently blocked
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return true;
  }

  // Reset if window has passed
  if (now - entry.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitStore.set(actionKey, {
      count: 1,
      firstAttempt: now,
      blockedUntil: null,
    });
    return false;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_CONFIG.maxAttempts) {
    entry.blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs;
    return true;
  }

  return false;
}

/**
 * Reset rate limit for an action (e.g., after successful login)
 */
export function resetRateLimit(actionKey: string): void {
  rateLimitStore.delete(actionKey);
}

/**
 * Get remaining time until rate limit expires
 */
export function getRateLimitRemainingTime(actionKey: string): number {
  const entry = rateLimitStore.get(actionKey);
  if (!entry?.blockedUntil) return 0;
  
  const remaining = entry.blockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ========================
// LOGGING (Development only)
// ========================

/**
 * Safe error logging - only logs in development
 */
export function safeLog(message: string, error?: unknown): void {
  if (import.meta.env.DEV) {
    console.error(message, error);
  }
}

/**
 * Safe console log - only logs in development
 */
export function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

// ========================
// CSRF PROTECTION
// ========================

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ========================
// SESSION SECURITY
// ========================

/**
 * Check if the session is still valid
 * Prevents session fixation attacks
 */
export function validateSessionAge(sessionCreatedAt: Date, maxAgeHours: number = 24): boolean {
  const now = new Date();
  const ageMs = now.getTime() - sessionCreatedAt.getTime();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  return ageMs < maxAgeMs;
}

// ========================
// CONTENT SECURITY
// ========================

/**
 * Validate URL to prevent open redirect vulnerabilities
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow same-origin redirects
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Validate that a URL is from an allowed domain
 */
export function isAllowedMediaUrl(url: string): boolean {
  const allowedDomains = [
    'supabase.co',
    'supabase.in',
    'lovable.app',
  ];
  
  try {
    const parsed = new URL(url);
    return allowedDomains.some(domain => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}
