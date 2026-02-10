/**
 * Video Protection Utilities
 * Comprehensive measures to prevent video downloading and leaking
 * Enhanced with maximum security measures
 */

import { logger } from './logger';

// ==========================================
// BLOCKED BROWSERS AND TOOLS
// ==========================================

const DOWNLOAD_TOOLS = [
  'coc_coc', 'coccocbrowser', 'coccoc',
  'idm', 'internetdownloadmanager', 
  'flashget', 'getright', 'dap',
  'eagleget', 'fdm', 'jdownloader',
  'wget', 'curl', 'aria2', 'axel',
  'python-requests', 'scrapy', 'httrack',
];

/**
 * Check if using a download-focused browser
 */
export function isBlockedBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return DOWNLOAD_TOOLS.some(tool => ua.includes(tool));
}

/**
 * Disable common download shortcuts and methods
 */
export function initializeVideoProtection() {
  // Check for download tools first
  if (isBlockedBrowser()) {
    logger.warn('Download tool detected');
  }

  // Prevent right-click on video elements
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('video') || target.closest('.video-protected') || target.closest('.protected-content')) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // Comprehensive keyboard shortcut blocking
  document.addEventListener('keydown', (e) => {
    // Ctrl+S, Ctrl+Shift+S (Save)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Ctrl+U (View source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      if (!import.meta.env.DEV) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    
    // F12 (DevTools)
    if (e.key === 'F12') {
      if (!import.meta.env.DEV) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    
    // Ctrl+Shift+I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
      if (!import.meta.env.DEV) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    
    // Ctrl+Shift+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
      if (!import.meta.env.DEV) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    
    // Ctrl+Shift+C (Inspect)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      if (!import.meta.env.DEV) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    
    // PrintScreen
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      try {
        navigator.clipboard.writeText('');
      } catch {
        // Ignore
      }
      return false;
    }
    
    // Ctrl+P (Print)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Windows/Mac screenshot shortcuts
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['s', 'S', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // Prevent drag and drop of video elements
  document.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'VIDEO' || target.closest('.video-protected')) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // Prevent copying video URLs
  document.addEventListener('copy', (e) => {
    const selection = window.getSelection()?.toString() || '';
    if (selection.includes('.mp4') || selection.includes('.m3u8') || selection.includes('/videos/')) {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
    }
  }, { capture: true });

  // Add print protection
  const printStyle = document.createElement('style');
  printStyle.textContent = `
    @media print {
      video, .video-protected, .protected-content {
        display: none !important;
        visibility: hidden !important;
      }
      body::before {
        content: 'Nội dung được bảo vệ - Không thể in';
        display: block;
        font-size: 24px;
        text-align: center;
        padding: 50px;
      }
    }
  `;
  document.head.appendChild(printStyle);

  logger.debug('Video protection initialized');
}

/**
 * Apply protection attributes to a video element
 */
export function applyVideoProtection(video: HTMLVideoElement) {
  // Maximum protection attributes
  video.setAttribute('controlsList', 'nodownload noremoteplayback nofullscreen');
  video.setAttribute('disablePictureInPicture', 'true');
  video.setAttribute('oncontextmenu', 'return false;');
  
  // Prevent selection and dragging
  video.style.userSelect = 'none';
  video.style.webkitUserSelect = 'none';
  (video.style as any).webkitTouchCallout = 'none';
  
  video.draggable = false;
  video.ondragstart = () => false;
  
  // Block right-click
  video.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, { capture: true });
}

/**
 * Detect screen recording attempts (basic detection)
 */
export function detectScreenRecording(): boolean {
  // Check for common recording indicators
  if (typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
    // Check if there are active screen captures
    // This is limited by browser APIs
  }
  
  // Check for unusual performance (recording can cause drops)
  const fps = measureFPS();
  if (fps < 15 && fps > 0) {
    logger.warn('Possible screen recording detected (low FPS)');
    return true;
  }
  
  return false;
}

let lastFrameTime = 0;
let frameCount = 0;
let fps = 60;

function measureFPS(): number {
  return fps;
}

/**
 * Start FPS monitoring
 */
export function startFPSMonitoring() {
  function updateFPS(timestamp: number) {
    frameCount++;
    
    if (timestamp - lastFrameTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFrameTime = timestamp;
    }
    
    requestAnimationFrame(updateFPS);
  }
  
  requestAnimationFrame(updateFPS);
}

/**
 * Obfuscate video source URL with cache-busting
 */
export function obfuscateVideoUrl(url: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${timestamp}&_r=${random}`;
}

/**
 * Create blob URL for video (harder to extract)
 */
export async function createSecureVideoBlob(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    logger.error('Failed to create secure video blob:', error);
    return null;
  }
}

/**
 * Revoke blob URL when done
 */
export function revokeSecureVideoBlob(blobUrl: string) {
  if (blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Detect if DevTools is open
 */
export function isDevToolsOpen(): boolean {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  
  return widthThreshold || heightThreshold;
}

/**
 * Add watermark overlay to video container (invisible by default)
 */
export function addVideoWatermark(container: HTMLElement, userId?: string, email?: string) {
  return;
  // Remove existing watermark
  const existing = container.querySelector('.video-watermark');
  if (existing) existing.remove();

  const watermark = document.createElement('div');
  watermark.className = 'video-watermark';
  
  const displayId = userId ? userId.slice(0, 8) : '';
  const displayEmail = email ? email.replace(/(.{3}).*(@.*)/, '$1***$2') : '';
  const timestamp = new Date().toISOString().slice(0, 19);
  
  watermark.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 16px;
    color: rgba(255, 255, 255, 0.03);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    z-index: 100;
    font-family: monospace;
    text-shadow: 0 0 1px rgba(0,0,0,0.1);
  `;
  watermark.textContent = displayId ? `${displayId} • ${timestamp}` : '';
  container.appendChild(watermark);
  
  // Update timestamp
  const updateInterval = setInterval(() => {
    if (!document.body.contains(watermark)) {
      clearInterval(updateInterval);
      return;
    }
    const newTimestamp = new Date().toISOString().slice(0, 19);
    watermark.textContent = displayId ? `${displayId} • ${newTimestamp}` : '';
  }, 1000);
  
  return watermark;
}

/**
 * Monitor for suspicious activity
 */
export function monitorSuspiciousActivity(callback: (activity: string) => void) {
  // Monitor for DevTools opening
  let devToolsOpen = isDevToolsOpen();
  
  const checkDevTools = () => {
    const currentlyOpen = isDevToolsOpen();
    if (currentlyOpen && !devToolsOpen) {
      callback('devtools_opened');
    }
    devToolsOpen = currentlyOpen;
  };
  
  setInterval(checkDevTools, 1000);
  
  // Monitor for tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      callback('tab_hidden');
    }
  });
  
  // Monitor for blur (user switching away)
  window.addEventListener('blur', () => {
    callback('window_blur');
  });
}

/**
 * Clear console periodically in production
 */
export function startConsoleCleaner() {
  if (import.meta.env.DEV) return;
  
  setInterval(() => {
    console.clear();
  }, 2000);
}
