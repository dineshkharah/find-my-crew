"use client";

import { useEffect, useState } from "react";
import type { GeoFix } from "@/lib/geo";

export type GeoStatus = "pending" | "granted" | "denied" | "unsupported";

export type UseGeolocation = {
  position: GeoFix | null;
  status: GeoStatus;
  retry: () => void;
};

function supported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function useGeolocation(active: boolean): UseGeolocation {
  const [position, setPosition] = useState<GeoFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>(() =>
    supported() ? "pending" : "unsupported",
  );
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!active || !supported()) return;

    const watchId = navigator.geolocation.watchPosition(
      (fix) => {
        setPosition({
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy: Number.isFinite(fix.coords.accuracy)
            ? Math.round(fix.coords.accuracy)
            : null,
        });
        setStatus("granted");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, retryCount]);

  function retry() {
    setStatus("pending");
    setRetryCount((n) => n + 1);
  }

  return { position, status, retry };
}
