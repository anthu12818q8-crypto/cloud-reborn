import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-signals",
};

interface DeviceSignals {
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  screenAvailWidth?: number;
  screenAvailHeight?: number;
  colorDepth?: number;
  pixelRatio?: number;
  timezone?: string;
  timezoneOffset?: number;
  language?: string;
  languages?: string[];
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  webglVendor?: string;
  webglRenderer?: string;
  webglVersion?: string;
  canvasHash?: string;
  audioHash?: string;
  doNotTrack?: string;
  cookieEnabled?: boolean;
  pdfViewerEnabled?: boolean;
  orientation?: string;
}

interface AuthRequest {
  action: "check_attempt" | "record_success" | "check_registration" | "register_device" | "detect_suspicious";
  attemptType?: "login" | "signup";
  userId?: string;
  signals: DeviceSignals;
}

/**
 * Generate STABLE device hash that works across browsers on same device
 * Uses HARDWARE signals that don't change when switching browsers:
 * - Screen resolution (same monitor)
 * - GPU info (same graphics card)
 * - CPU cores & memory (same hardware)
 * - Timezone (same location)
 * - IP address (same network)
 */
async function generateStableDeviceHash(signals: DeviceSignals, ip: string): Promise<string> {
  // Primary: Hardware-based signals (STABLE across browsers)
  const hardwareComponents = [
    // Screen - same monitor always gives same values
    signals.screenWidth?.toString() || "",
    signals.screenHeight?.toString() || "",
    signals.screenAvailWidth?.toString() || "",
    signals.screenAvailHeight?.toString() || "",
    signals.colorDepth?.toString() || "",
    signals.pixelRatio?.toString() || "",
    // GPU - same graphics card
    signals.webglVendor || "",
    signals.webglRenderer || "",
    // CPU/RAM - same hardware
    signals.hardwareConcurrency?.toString() || "",
    signals.deviceMemory?.toString() || "",
    // Touch - same device type
    signals.maxTouchPoints?.toString() || "",
    // System
    signals.timezone || "",
    signals.timezoneOffset?.toString() || "",
    signals.platform || "",
  ];

  // Include IP as strong identifier (same physical device = same IP usually)
  const stableData = [...hardwareComponents, ip].join("|");
  
  // Generate primary hash from stable signals
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(stableData);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate IP-based hash as fallback (for when device signals might vary)
 * This catches users trying to bypass by changing browsers
 */
async function generateIpHash(ip: string, timezone: string): Promise<string> {
  const data = `${ip}|${timezone}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from headers (multiple sources for reliability)
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    const clientIp = cfConnectingIp || forwardedFor?.split(",")[0]?.trim() || realIp || "0.0.0.0";

    // Anti-bot: Add random delay (50-200ms) to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));

    const body: AuthRequest = await req.json();
    const { action, attemptType = "login", userId, signals } = body;

    // Validate signals exist
    if (!signals || typeof signals !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid request", code: "INVALID_SIGNALS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate STABLE device hash (works across browsers)
    const deviceHash = await generateStableDeviceHash(signals, clientIp);
    
    // Generate IP-based hash as secondary check
    const ipHash = await generateIpHash(clientIp, signals.timezone || "");

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result;

    switch (action) {
      case "check_attempt": {
        // First check if device is blocked (using stable hash)
        const { data: suspiciousData } = await supabase.rpc("detect_suspicious_activity", {
          p_device_hash: deviceHash,
          p_ip_address: clientIp,
        });

        if (suspiciousData?.blocked) {
          return new Response(
            JSON.stringify({
              blocked: true,
              reason: suspiciousData.reason,
              deviceHash: deviceHash.substring(0, 8) + "...",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Also check IP-based hash (catches browser changers)
        const { data: ipSuspiciousData } = await supabase.rpc("detect_suspicious_activity", {
          p_device_hash: ipHash,
          p_ip_address: clientIp,
        });

        if (ipSuspiciousData?.blocked) {
          return new Response(
            JSON.stringify({
              blocked: true,
              reason: "ip_blocked",
              deviceHash: ipHash.substring(0, 8) + "...",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check/record the attempt with BOTH hashes
        // Use device hash as primary
        const { data: attemptData, error: attemptError } = await supabase.rpc(
          "server_check_auth_attempt",
          {
            p_device_hash: deviceHash,
            p_ip_address: clientIp,
            p_attempt_type: attemptType,
            p_is_success: false,
          }
        );

        if (attemptError) throw attemptError;

        // Also record for IP hash (so changing browser doesn't reset count)
        if (deviceHash !== ipHash) {
          await supabase.rpc("server_check_auth_attempt", {
            p_device_hash: ipHash,
            p_ip_address: clientIp,
            p_attempt_type: attemptType,
            p_is_success: false,
          });
        }

        result = attemptData;
        break;
      }

      case "record_success": {
        // Record successful login/signup for BOTH hashes
        const { data: successData, error: successError } = await supabase.rpc(
          "server_check_auth_attempt",
          {
            p_device_hash: deviceHash,
            p_ip_address: clientIp,
            p_attempt_type: attemptType,
            p_is_success: true,
          }
        );

        if (successError) throw successError;

        // Also reset IP hash
        if (deviceHash !== ipHash) {
          await supabase.rpc("server_check_auth_attempt", {
            p_device_hash: ipHash,
            p_ip_address: clientIp,
            p_attempt_type: attemptType,
            p_is_success: true,
          });
        }

        // If signup success, register the device
        if (attemptType === "signup" && userId) {
          // Register both hashes
          await supabase.rpc("register_device_account", {
            p_device_hash: deviceHash,
            p_user_id: userId,
            p_ip_address: clientIp,
          });
          
          await supabase.rpc("register_device_account", {
            p_device_hash: ipHash,
            p_user_id: userId,
            p_ip_address: clientIp,
          });
        }

        result = successData;
        break;
      }

      case "check_registration": {
        // Check BOTH hashes for registration limit
        const { data: regData, error: regError } = await supabase.rpc(
          "check_device_registration_limit",
          {
            p_device_hash: deviceHash,
            p_max_accounts: 3,
          }
        );

        if (regError) throw regError;

        // Also check IP hash
        const { data: ipRegData } = await supabase.rpc(
          "check_device_registration_limit",
          {
            p_device_hash: ipHash,
            p_max_accounts: 3,
          }
        );

        // If either is at limit, block
        if (!regData?.allowed || !ipRegData?.allowed) {
          result = {
            allowed: false,
            current_count: Math.max(regData?.current_count || 0, ipRegData?.current_count || 0),
            max_allowed: 3,
            reason: "max_accounts_reached",
          };
        } else {
          result = regData;
        }
        break;
      }

      case "register_device": {
        // Register device for a new account
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Missing userId", code: "MISSING_USER_ID" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Register BOTH hashes
        const { error: registerError } = await supabase.rpc("register_device_account", {
          p_device_hash: deviceHash,
          p_user_id: userId,
          p_ip_address: clientIp,
        });

        if (registerError) throw registerError;

        await supabase.rpc("register_device_account", {
          p_device_hash: ipHash,
          p_user_id: userId,
          p_ip_address: clientIp,
        });

        result = { success: true };
        break;
      }

      case "detect_suspicious": {
        // Check BOTH hashes for suspicious activity
        const { data: detectData, error: detectError } = await supabase.rpc(
          "detect_suspicious_activity",
          {
            p_device_hash: deviceHash,
            p_ip_address: clientIp,
          }
        );

        if (detectError) throw detectError;

        // Also check IP hash
        const { data: ipDetectData } = await supabase.rpc(
          "detect_suspicious_activity",
          {
            p_device_hash: ipHash,
            p_ip_address: clientIp,
          }
        );

        // If either is blocked/suspicious, report it
        if (detectData?.blocked || ipDetectData?.blocked) {
          result = {
            suspicious: true,
            blocked: true,
            reason: detectData?.reason || ipDetectData?.reason || "device_blocked",
          };
        } else {
          result = {
            ...detectData,
            suspicious: detectData?.suspicious || ipDetectData?.suspicious,
            score: Math.max(detectData?.score || 0, ipDetectData?.score || 0),
          };
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action", code: "UNKNOWN_ACTION" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auth security error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
