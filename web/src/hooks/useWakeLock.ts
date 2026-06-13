"use client";

import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = await wakeLock.request("screen");
      } catch {
        sentinel = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) request();
    };

    request();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
