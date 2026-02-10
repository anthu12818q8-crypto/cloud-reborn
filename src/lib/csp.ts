/**
 * Content Security Policy helpers
 * Additional client-side security measures
 */

/**
 * Add meta CSP tag dynamically
 * Note: This is supplementary to server-side CSP headers
 */
export function initializeCSP() {
  // Only add if not already present
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    return;
  }

  const cspContent = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Vite
    "style-src 'self' 'unsafe-inline'", // Required for inline styles
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
    "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = cspContent;
  document.head.appendChild(meta);
}

/**
 * Prevent clickjacking by checking if in iframe
 */
export function preventClickjacking() {
  if (window.self !== window.top) {
    // We're in an iframe - this could be clickjacking
    // Allow only trusted origins (Lovable preview)
    try {
      const parentOrigin = window.parent.location.origin;
      const trustedOrigins = [
        'https://lovable.dev',
        'https://lovable.app',
        window.location.origin,
      ];
      
      if (!trustedOrigins.some(origin => parentOrigin.includes(origin))) {
        document.body.innerHTML = '<h1>Access Denied</h1>';
        throw new Error('Clickjacking attempt detected');
      }
    } catch {
      // Cross-origin iframe - can't access parent location
      // This is suspicious but might be legitimate (e.g., preview embed)
    }
  }
}

/**
 * Disable developer tools detection (basic)
 * Note: This is easily bypassed but adds a layer of difficulty
 */
export function initializeDevToolsProtection() {
  // Disable right-click context menu on sensitive areas
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('video') || target.closest('.protected-content')) {
      e.preventDefault();
    }
  });

  // Detect F12 and Ctrl+Shift+I
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
    ) {
      // Don't prevent in development
      if (!import.meta.env.DEV) {
        e.preventDefault();
      }
    }
  });
}
