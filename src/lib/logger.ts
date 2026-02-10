/**
 * Secure logging utility
 * Only logs in development mode to prevent information leakage
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log errors only in development
   */
  error: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.error(`[ERROR] ${message}`, ...args);
    }
    // In production, you could send to a secure logging service
    // Example: sendToLogService({ level: 'error', message, args });
  },

  /**
   * Log warnings only in development
   */
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Log info only in development
   */
  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log debug only in development
   */
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};

/**
 * Get a sanitized error message for user display
 * Never expose internal error details to users
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Map known error types to user-friendly messages
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'Email hoặc mật khẩu không đúng',
      'Email not confirmed': 'Vui lòng xác nhận email trước khi đăng nhập',
      'User not found': 'Không tìm thấy tài khoản',
      'Password is too weak': 'Mật khẩu quá yếu',
      'Rate limit exceeded': 'Quá nhiều yêu cầu, vui lòng thử lại sau',
      'Network error': 'Lỗi kết nối mạng',
    };

    for (const [key, value] of Object.entries(errorMap)) {
      if (error.message.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
  }
  
  return 'Đã xảy ra lỗi, vui lòng thử lại sau';
}

/**
 * Sanitize sensitive data from objects before logging
 */
export function sanitizeForLogging<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key as keyof T] = '[REDACTED]' as T[keyof T];
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeForLogging(value as Record<string, unknown>) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value as T[keyof T];
    }
  }
  
  return sanitized;
}
