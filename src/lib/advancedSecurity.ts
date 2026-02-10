/**
 * Advanced Security Module - Maximum Video Protection
 * Implements multi-layer defense against content theft
 */

import { logger } from './logger';

// ==========================================
// DOWNLOAD TOOL & EXTENSION DETECTION
// ==========================================

const BLOCKED_USER_AGENTS = [
  'coc_coc', 'coccocbrowser', 'coccoc',
  'idm', 'internetdownloadmanager', 'download accelerator',
  'flashget', 'getright', 'dap', 'download manager',
  'eagleget', 'fdm', 'free download manager',
  'jdownloader', '1dm', 'adm', 'turboadm',
  'wget', 'curl', 'aria2', 'axel',
  'python-requests', 'python-urllib', 'scrapy',
  'httrack', 'webcopier', 'teleport',
];

const SUSPICIOUS_HEADERS = [
  'x-forwarded-for', // proxy detection
];

/**
 * Detect if user is using a download tool/browser
 */
export function isDownloadToolDetected(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  
  // Check against blocked user agents
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (ua.includes(blocked)) {
      logger.warn('Download tool detected:', blocked);
      return true;
    }
  }
  
  // Check for Cốc Cốc specifically
  if (ua.includes('coc_coc') || navigator.vendor?.toLowerCase().includes('coc')) {
    logger.warn('Cốc Cốc browser detected');
    return true;
  }
  
  return false;
}

/**
 * Detect browser extensions that could intercept video
 */
export function detectSuspiciousExtensions(): boolean {
  // Check for video download extensions
  const extensionIndicators = [
    'videodownloadhelper',
    'downloadhelper',
    'video-downloadhelper',
    'savefrom',
  ];
  
  // Check window properties that extensions might add
  for (const indicator of extensionIndicators) {
    if ((window as any)[indicator] !== undefined) {
      return true;
    }
  }
  
  return false;
}

// ==========================================
// ANTI-DEBUGGING MEASURES
// ==========================================

let debuggerDetected = false;
let devToolsOpenCount = 0;

/**
 * Aggressive DevTools detection
 */
export function detectDevTools(): boolean {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  return widthThreshold || heightThreshold;
}

/**
 * Debugger detection using timing
 */
export function detectDebugger(): boolean {
  const start = performance.now();
  // Debugger will pause here if active
  debugger;
  const end = performance.now();
  
  // If more than 100ms passed, debugger was likely active
  if (end - start > 100) {
    debuggerDetected = true;
    return true;
  }
  
  return false;
}

/**
 * Monitor for DevTools continuously
 */
export function startDevToolsMonitoring(onDetected: () => void): () => void {
  const checkInterval = setInterval(() => {
    if (detectDevTools()) {
      devToolsOpenCount++;
      if (devToolsOpenCount >= 3) {
        onDetected();
      }
    } else {
      devToolsOpenCount = Math.max(0, devToolsOpenCount - 1);
    }
  }, 1000);
  
  return () => clearInterval(checkInterval);
}

// ==========================================
// NETWORK REQUEST INTERCEPTION
// ==========================================

const originalFetch = window.fetch;
const originalXHROpen = XMLHttpRequest.prototype.open;

/**
 * Monitor and protect network requests
 */
export function installNetworkProtection(): void {
  // Wrap fetch to detect suspicious patterns
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    
    // Check if request is trying to download video
    if (isVideoDownloadAttempt(url)) {
      logger.warn('Suspicious video download attempt blocked:', url);
      throw new Error('Unauthorized request');
    }
    
    return originalFetch.apply(this, args);
  };
}

function isVideoDownloadAttempt(url: string): boolean {
  // Block requests that look like direct video downloads from suspicious sources
  const suspiciousPatterns = [
    /download.*video/i,
    /video.*download/i,
    /getvideofile/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(url));
}

// ==========================================
// VIDEO ELEMENT PROTECTION
// ==========================================

/**
 * Apply maximum protection to video element
 */
export function protectVideoElement(video: HTMLVideoElement): void {
  // Disable all native controls and download options
  video.setAttribute('controlsList', 'nodownload noremoteplayback nofullscreen');
  video.setAttribute('disablePictureInPicture', 'true');
  video.setAttribute('oncontextmenu', 'return false;');
  video.setAttribute('crossorigin', 'anonymous');
  
  // Prevent downloading via drag
  video.draggable = false;
  video.ondragstart = () => false;
  
  // Prevent copying
  video.style.userSelect = 'none';
  video.style.webkitUserSelect = 'none';
  (video.style as any).webkitTouchCallout = 'none';
  
  // Add CSS protection layer
  video.style.pointerEvents = 'auto';
}

/**
 * Create protected video container with overlay
 */
export function createProtectedVideoContainer(container: HTMLElement): void {
  // Add invisible overlay to prevent inspection
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    pointer-events: none;
  `;
  overlay.className = 'video-protection-overlay';
  container.style.position = 'relative';
  container.appendChild(overlay);
}

// ==========================================
// DYNAMIC WATERMARK
// ==========================================

/**
 * Create dynamic watermark for video
 */
export function createDynamicWatermark(
  container: HTMLElement,
  userId?: string,
  email?: string
): HTMLElement {
  const watermark = document.createElement('div');
  watermark.className = 'dynamic-watermark';
  
  // Create semi-transparent watermark
  const watermarkText = userId ? `ID: ${userId.slice(0, 8)}` : '';
  const timestamp = new Date().toISOString().slice(0, 19);
  
  watermark.innerHTML = `
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 20px;
      color: rgba(255, 255, 255, 0.05);
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 10;
      font-family: monospace;
    ">${watermarkText}</div>
    <div style="
      position: absolute;
      bottom: 10px;
      right: 10px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.03);
      pointer-events: none;
      user-select: none;
      z-index: 10;
    ">${timestamp}</div>
  `;
  
  container.appendChild(watermark);
  
  // Update timestamp periodically
  setInterval(() => {
    const timestampEl = watermark.querySelector('div:last-child');
    if (timestampEl) {
      timestampEl.textContent = new Date().toISOString().slice(0, 19);
    }
  }, 1000);
  
  return watermark;
}

// ==========================================
// CLIPBOARD PROTECTION
// ==========================================

/**
 * Prevent video URL from being copied
 */
export function installClipboardProtection(): void {
  document.addEventListener('copy', (e) => {
    const selection = window.getSelection()?.toString() || '';
    
    // Check if copied content looks like a video URL
    if (
      selection.includes('.mp4') ||
      selection.includes('.m3u8') ||
      selection.includes('/videos/') ||
      selection.includes('storage/v1/object')
    ) {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', 'Content protected');
      logger.warn('Video URL copy attempt blocked');
    }
  });
  
  // Also protect cut
  document.addEventListener('cut', (e) => {
    const selection = window.getSelection()?.toString() || '';
    if (selection.includes('.mp4') || selection.includes('.m3u8')) {
      e.preventDefault();
    }
  });
}

// ==========================================
// BLOB URL PROTECTION
// ==========================================

const activeBlobUrls = new Map<string, number>();

/**
 * Create secure blob URL with auto-revocation
 */
export function createSecureBlobUrl(blob: Blob, expirationMs: number = 30000): string {
  const url = URL.createObjectURL(blob);
  const expiresAt = Date.now() + expirationMs;
  
  activeBlobUrls.set(url, expiresAt);
  
  // Auto-revoke after expiration
  setTimeout(() => {
    revokeBlobUrl(url);
  }, expirationMs);
  
  return url;
}

/**
 * Revoke blob URL
 */
export function revokeBlobUrl(url: string): void {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
}

/**
 * Clean up all blob URLs
 */
export function cleanupAllBlobUrls(): void {
  activeBlobUrls.forEach((_, url) => {
    URL.revokeObjectURL(url);
  });
  activeBlobUrls.clear();
}

// ==========================================
// KEYBOARD SHORTCUT BLOCKING
// ==========================================

/**
 * Block all keyboard shortcuts that could be used for downloading
 */
export function installKeyboardProtection(): void {
  document.addEventListener('keydown', (e) => {
    // Block Ctrl+S (Save)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+U (View source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+Shift+I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+Shift+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+Shift+C (Inspect element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      return false;
    }
    
    // Block F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    
    // Block PrintScreen
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      navigator.clipboard?.writeText?.('');
      return false;
    }
    
    // Block Ctrl+P (Print)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      return false;
    }
    
    // Block Windows screenshot shortcuts
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });
}

// ==========================================
// CONSOLE PROTECTION
// ==========================================

/**
 * Disable and clear console in production
 */
export function disableConsole(): void {
  if (import.meta.env.DEV) return;
  
  const noop = () => {};
  
  // Store original console for internal use
  const originalConsole = { ...console };
  
  // Clear console periodically
  setInterval(() => {
    console.clear();
  }, 1000);
  
  // Disable console methods
  Object.keys(console).forEach(key => {
    (console as any)[key] = noop;
  });
  
  // Keep internal logging
  (window as any).__internalLog = originalConsole.log;
}

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize all security measures
 */
export function initializeAdvancedSecurity(): void {
  // Only apply aggressive security in production
  if (import.meta.env.DEV) {
    logger.debug('Security measures disabled in development');
    return;
  }
  
  // Check for download tools
  if (isDownloadToolDetected()) {
    logger.warn('Download tool detected - limited functionality');
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#fff;text-align:center;padding:20px;">
        <div>
          <h1>Trình duyệt không được hỗ trợ</h1>
          <p>Vui lòng sử dụng Chrome, Firefox, Safari hoặc Edge để xem phim.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Install protections
  installKeyboardProtection();
  installClipboardProtection();
  disableConsole();
  
  // Monitor for DevTools
  startDevToolsMonitoring(() => {
    logger.warn('DevTools detected - video paused');
    // Pause all videos when DevTools is detected
    document.querySelectorAll('video').forEach(video => {
      video.pause();
      video.src = '';
    });
  });
  
  // Add print protection via CSS
  const printStyle = document.createElement('style');
  printStyle.textContent = `
    @media print {
      body * {
        display: none !important;
      }
      body::after {
        content: 'Printing is disabled';
        display: block;
        font-size: 24px;
        text-align: center;
        padding: 50px;
      }
    }
  `;
  document.head.appendChild(printStyle);
  
  logger.debug('Advanced security initialized');
}
