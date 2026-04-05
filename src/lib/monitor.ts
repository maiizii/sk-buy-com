import {
  getMonitorEnabledPlatforms,
  saveConnectivityLog,
  cleanOldConnectivityLogs,
  type Platform,
} from "./db";

// ============================================================
// Configuration
// ============================================================
const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 10 * 1000; // 10 seconds

// ============================================================
// Health Check — Single Platform
// ============================================================
export async function checkPlatformHealth(
  platform: Platform
): Promise<{ success: boolean; latency: number; error: string }> {
  if (!platform.baseUrl) {
    return { success: false, latency: 0, error: "Base URL not configured" };
  }

  // Normalize base URL: remove trailing slash
  const baseUrl = platform.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/chat/completions`;

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer sk-test-connectivity-check",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const latency = Date.now() - startTime;

    // HTTP < 500 means the server is responding (even 401/403 is "connected")
    if (response.status < 500) {
      return { success: true, latency, error: "" };
    } else {
      return {
        success: false,
        latency,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }
  } catch (err) {
    const latency = Date.now() - startTime;
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    // AbortError means timeout
    if (
      err instanceof Error &&
      (err.name === "AbortError" || errorMessage.includes("abort"))
    ) {
      return { success: false, latency, error: "Request timeout (10s)" };
    }

    return { success: false, latency, error: errorMessage };
  }
}

// ============================================================
// Monitor Cycle — Check All Enabled Platforms
// ============================================================
export async function runMonitorCycle(): Promise<void> {
  const platforms = getMonitorEnabledPlatforms();

  if (platforms.length === 0) {
    console.log("[Monitor] No platforms with monitoring enabled, skipping.");
    return;
  }

  console.log(
    `[Monitor] Starting health check cycle for ${platforms.length} platform(s)...`
  );

  for (const platform of platforms) {
    try {
      const result = await checkPlatformHealth(platform);
      saveConnectivityLog(
        platform.id,
        result.success,
        result.latency,
        result.error
      );
      console.log(
        `[Monitor] ${platform.name}: ${result.success ? "✓" : "✗"} ${result.latency}ms${result.error ? ` (${result.error})` : ""}`
      );
    } catch (err) {
      console.error(`[Monitor] Error checking ${platform.name}:`, err);
      saveConnectivityLog(platform.id, false, 0, "Internal monitor error");
    }
  }

  // Clean up old logs based on the current retention window.
  const cleaned = cleanOldConnectivityLogs();
  if (cleaned > 0) {
    console.log(`[Monitor] Cleaned ${cleaned} old connectivity log(s).`);
  }

  console.log("[Monitor] Health check cycle complete.");
}

// ============================================================
// Monitor Loop — Singleton setInterval
// ============================================================
let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startMonitorLoop(): void {
  if (monitorInterval) {
    console.log("[Monitor] Loop already running.");
    return;
  }

  console.log(
    `[Monitor] Starting monitor loop (interval: ${MONITOR_INTERVAL_MS / 1000}s)...`
  );

  // Run immediately on start
  runMonitorCycle().catch((err) =>
    console.error("[Monitor] Initial cycle error:", err)
  );

  // Then schedule recurring runs
  monitorInterval = setInterval(() => {
    runMonitorCycle().catch((err) =>
      console.error("[Monitor] Cycle error:", err)
    );
  }, MONITOR_INTERVAL_MS);
}

export function stopMonitorLoop(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("[Monitor] Loop stopped.");
  }
}

// ============================================================
// Auto-start (skip during build)
// ============================================================
function isBuildRuntime() {
  const lifecycleEvent = process.env.npm_lifecycle_event?.toLowerCase() || "";
  const nextPhase = process.env.NEXT_PHASE?.toLowerCase() || "";
  const argv = process.argv.join(" ").toLowerCase();

  return (
    lifecycleEvent === "build" ||
    nextPhase.includes("build") ||
    Boolean(process.env.__NEXT_PRIVATE_BUILD_WORKER) ||
    argv.includes("next build")
  );
}

if (!isBuildRuntime()) {
  // Use a small delay to avoid blocking module initialization
  setTimeout(() => {
    startMonitorLoop();
  }, 3000);
}
