import { getAllSksSites, getPreferredResolvedSksCredential } from "@/lib/sks/db";
import { runSksFullProbe } from "@/lib/sks/probe";

const SKS_MONITOR_INTERVAL_MS = 60 * 60 * 1000;
const SKS_MONITOR_START_DELAY_MS = 3_000;

type SksMonitorGlobal = typeof globalThis & {
  __sksMonitorInterval?: ReturnType<typeof setInterval>;
  __sksMonitorCycleRunning?: boolean;
  __sksMonitorStartScheduled?: boolean;
};

const sksMonitorGlobal = globalThis as SksMonitorGlobal;

export async function runSksMonitorCycle(): Promise<void> {
  if (sksMonitorGlobal.__sksMonitorCycleRunning) {
    console.log("[SKS Monitor] Previous cycle is still running, skipping.");
    return;
  }

  sksMonitorGlobal.__sksMonitorCycleRunning = true;

  try {
    const candidates = getAllSksSites()
      .filter((site) => site.statusVisibility !== "private")
      .map((site) => ({
        site,
        credential: getPreferredResolvedSksCredential(site.id),
      }))
      .filter(
        (item): item is { site: ReturnType<typeof getAllSksSites>[number]; credential: NonNullable<ReturnType<typeof getPreferredResolvedSksCredential>> } =>
          Boolean(item.credential)
      );

    if (candidates.length === 0) {
      console.log("[SKS Monitor] No enabled SKS credentials found, skipping.");
      return;
    }

    console.log(
      `[SKS Monitor] Starting full probe cycle for ${candidates.length} site(s)...`
    );

    for (const { site, credential } of candidates) {
      try {
        const result = await runSksFullProbe(site.id, {
          credentialId: credential.record.id,
          fallbackToCurrentModels: false,
        });

        console.log(
          `[SKS Monitor] ${site.displayName}: model-list=${result.modelListProbe?.status || "unknown"}, synced-models=${result.syncedModels.length}, model-tests=${result.testedModels.length}`
        );
      } catch (error) {
        console.error(`[SKS Monitor] ${site.displayName} probe failed:`, error);
      }
    }

    console.log("[SKS Monitor] Full probe cycle complete.");
  } finally {
    sksMonitorGlobal.__sksMonitorCycleRunning = false;
  }
}

export function startSksMonitorLoop(): void {
  if (sksMonitorGlobal.__sksMonitorInterval) {
    console.log("[SKS Monitor] Loop already running.");
    return;
  }

  console.log(
    `[SKS Monitor] Starting loop (interval: ${SKS_MONITOR_INTERVAL_MS / 60_000}m)...`
  );

  runSksMonitorCycle().catch((error) => {
    console.error("[SKS Monitor] Initial cycle failed:", error);
  });

  sksMonitorGlobal.__sksMonitorInterval = setInterval(() => {
    runSksMonitorCycle().catch((error) => {
      console.error("[SKS Monitor] Cycle failed:", error);
    });
  }, SKS_MONITOR_INTERVAL_MS);
}

export function stopSksMonitorLoop(): void {
  if (sksMonitorGlobal.__sksMonitorInterval) {
    clearInterval(sksMonitorGlobal.__sksMonitorInterval);
    sksMonitorGlobal.__sksMonitorInterval = undefined;
    console.log("[SKS Monitor] Loop stopped.");
  }
}

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

if (
  !isBuildRuntime() &&
  !sksMonitorGlobal.__sksMonitorInterval &&
  !sksMonitorGlobal.__sksMonitorStartScheduled
) {
  sksMonitorGlobal.__sksMonitorStartScheduled = true;

  setTimeout(() => {
    sksMonitorGlobal.__sksMonitorStartScheduled = false;
    startSksMonitorLoop();
  }, SKS_MONITOR_START_DELAY_MS);
}
