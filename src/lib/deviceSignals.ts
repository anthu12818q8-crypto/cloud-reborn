// Client-side device signal collection
// NOTE: These are RAW signals only - the actual fingerprint is computed SERVER-SIDE
// This prevents any client-side manipulation of the device ID
// 
// IMPORTANT: Signals are designed to be STABLE across browsers on same device
// The server uses hardware-based signals (screen, GPU, CPU, memory) + IP for identification

export interface DeviceSignals {
  // Basic info (may vary by browser)
  userAgent: string;
  
  // Hardware signals (STABLE across browsers)
  screenWidth: number;
  screenHeight: number;
  screenAvailWidth: number;
  screenAvailHeight: number;
  colorDepth: number;
  pixelRatio: number;
  
  // System signals (STABLE across browsers)
  timezone: string;
  timezoneOffset: number;
  language: string;
  languages: string[];
  platform: string;
  
  // Hardware info (STABLE - same physical device)
  hardwareConcurrency: number;
  deviceMemory: number | null;
  maxTouchPoints: number;
  
  // GPU info (STABLE - same graphics card)
  webglVendor: string;
  webglRenderer: string;
  webglVersion: string;
  
  // Fingerprints (may vary slightly by browser)
  canvasHash: string;
  audioHash: string;
  
  // Additional stable signals
  doNotTrack: string | null;
  cookieEnabled: boolean;
  pdfViewerEnabled: boolean;
  
  // Screen orientation
  orientation: string;
}

// Get WebGL info - STABLE across browsers (same GPU)
function getWebGLInfo(): { vendor: string; renderer: string; version: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { vendor: '', renderer: '', version: '' };
    
    const glContext = gl as WebGLRenderingContext;
    const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
    
    return {
      vendor: debugInfo ? glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '' : '',
      renderer: debugInfo ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '' : '',
      version: glContext.getParameter(glContext.VERSION) || '',
    };
  } catch {
    return { vendor: '', renderer: '', version: '' };
  }
}

// Generate canvas fingerprint hash
function getCanvasHash(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Draw some text and shapes
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Cwm fjordbank', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('glyphs vext quiz', 4, 17);
    
    // Convert to data URL and hash it
    const dataUrl = canvas.toDataURL();
    return simpleHash(dataUrl);
  } catch {
    return '';
  }
}

// Generate audio fingerprint hash
function getAudioHash(): string {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return '';
    
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
    
    gain.gain.value = 0; // Mute
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;
    
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gain);
    gain.connect(context.destination);
    
    oscillator.start(0);
    
    const bins = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(bins);
    
    oscillator.stop();
    context.close();
    
    // Hash the frequency data
    return simpleHash(bins.slice(0, 30).join(','));
  } catch {
    return '';
  }
}

// Simple hash function (not cryptographic - just for fingerprinting)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Get screen orientation
function getOrientation(): string {
  try {
    if (screen.orientation) {
      return screen.orientation.type;
    }
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  } catch {
    return 'unknown';
  }
}

// Collect all device signals - focus on HARDWARE signals that don't change across browsers
export async function collectDeviceSignals(): Promise<DeviceSignals> {
  const webgl = getWebGLInfo();
  
  return {
    // Basic (may vary)
    userAgent: navigator.userAgent,
    
    // Screen - STABLE (same monitor)
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenAvailWidth: screen.availWidth,
    screenAvailHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    
    // System - STABLE
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language,
    languages: [...(navigator.languages || [navigator.language])],
    platform: navigator.platform,
    
    // Hardware - STABLE (same CPU/RAM)
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemory: (navigator as any).deviceMemory || null,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    
    // GPU - STABLE (same graphics card)
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    webglVersion: webgl.version,
    
    // Fingerprints
    canvasHash: getCanvasHash(),
    audioHash: getAudioHash(),
    
    // Additional
    doNotTrack: navigator.doNotTrack,
    cookieEnabled: navigator.cookieEnabled,
    pdfViewerEnabled: (navigator as any).pdfViewerEnabled ?? true,
    
    // Orientation
    orientation: getOrientation(),
  };
}

// Cache the signals to avoid recollecting on every request
let cachedSignals: DeviceSignals | null = null;

export async function getCachedDeviceSignals(): Promise<DeviceSignals> {
  if (!cachedSignals) {
    cachedSignals = await collectDeviceSignals();
  }
  return cachedSignals;
}

export function clearSignalsCache(): void {
  cachedSignals = null;
}
