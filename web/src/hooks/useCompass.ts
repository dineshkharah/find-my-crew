"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CompassStatus =
  | "idle"
  | "active"
  | "needs-permission"
  | "unsupported";

type IosOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

export type UseCompass = {
  heading: number | null;
  status: CompassStatus;
  enable: () => void;
};

function initialStatus(): CompassStatus {
  if (typeof window === "undefined") return "idle";
  const orientation = window.DeviceOrientationEvent as
    | IosOrientationEvent
    | undefined;
  if (!orientation) return "unsupported";
  if (typeof orientation.requestPermission === "function") {
    return "needs-permission";
  }
  return "idle";
}

export function useCompass(): UseCompass {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<CompassStatus>(initialStatus);
  const cleanupRef = useRef<(() => void) | null>(null);

  const start = useCallback(() => {
    const handler = (event: DeviceOrientationEvent) => {
      const compass = event as CompassEvent;
      if (typeof compass.webkitCompassHeading === "number") {
        setHeading(compass.webkitCompassHeading);
        setStatus("active");
        return;
      }
      if (event.absolute && typeof event.alpha === "number") {
        setHeading((360 - event.alpha) % 360);
        setStatus("active");
      }
    };
    window.addEventListener(
      "deviceorientationabsolute",
      handler as EventListener,
    );
    window.addEventListener("deviceorientation", handler);
    cleanupRef.current = () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handler as EventListener,
      );
      window.removeEventListener("deviceorientation", handler);
    };
  }, []);

  const enable = useCallback(() => {
    const orientation = window.DeviceOrientationEvent as
      | IosOrientationEvent
      | undefined;
    if (orientation && typeof orientation.requestPermission === "function") {
      orientation
        .requestPermission()
        .then((result) => {
          if (result === "granted") {
            setStatus("active");
            start();
          } else {
            setStatus("unsupported");
          }
        })
        .catch(() => setStatus("unsupported"));
    } else {
      start();
    }
  }, [start]);

  useEffect(() => {
    const orientation = window.DeviceOrientationEvent as
      | IosOrientationEvent
      | undefined;
    if (orientation && typeof orientation.requestPermission !== "function") {
      start();
    }
    return () => cleanupRef.current?.();
  }, [start]);

  return { heading, status, enable };
}
