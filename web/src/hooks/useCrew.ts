"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CrewError,
  rejoinCrew,
  type Member,
  type PositionEvent,
} from "@/lib/crew";
import { distanceMeters, type GeoFix, type GeoPoint } from "@/lib/geo";
import { clearSession, loadSession } from "@/lib/session";
import { getSocket } from "@/lib/socket";

const MIN_SEND_GAP_MS = 2500;
const MIN_MOVE_METERS = 3;
const HEARTBEAT_MS = 10_000;

export type CrewStatus = "connecting" | "waking" | "ready" | "ended" | "error";
export type GeoStatus = "pending" | "granted" | "denied" | "unsupported";

export type UseCrew = {
  status: CrewStatus;
  members: Member[];
  memberId: string | null;
  connected: boolean;
  ownPosition: GeoFix | null;
  geoStatus: GeoStatus;
  retryGeo: () => void;
  now: number;
};

export function useCrew(code: string): UseCrew {
  const router = useRouter();
  const [status, setStatus] = useState<CrewStatus>("connecting");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId] = useState(() => loadSession()?.memberId ?? null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [ownPosition, setOwnPosition] = useState<GeoFix | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(() =>
    typeof navigator === "undefined" || "geolocation" in navigator
      ? "pending"
      : "unsupported",
  );
  const [geoRetry, setGeoRetry] = useState(0);
  const sendStateRef = useRef<{ sentAt: number; sent: GeoPoint | null }>({
    sentAt: 0,
    sent: null,
  });

  useEffect(() => {
    const session = loadSession();
    if (!session || session.code !== code) {
      router.replace(`/join?code=${code}`);
      return;
    }

    const socket = getSocket();
    let cancelled = false;

    const onMembers = (list: Member[]) => setMembers(list);
    const onPosition = (event: PositionEvent) =>
      setMembers((prev) =>
        prev.map((member) =>
          member.id === event.memberId
            ? {
                ...member,
                position: {
                  lat: event.lat,
                  lng: event.lng,
                  accuracy: event.accuracy,
                  at: event.at,
                },
              }
            : member,
        ),
      );
    const onClosed = () => {
      clearSession();
      setStatus("ended");
    };
    const onDisconnect = () => setConnected(false);

    const rejoin = async () => {
      try {
        const result = await rejoinCrew(session);
        if (cancelled) return;
        setMembers(result.members);
        setStatus("ready");
        setConnected(true);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof CrewError && error.reason === "not_found") {
          clearSession();
          setStatus("ended");
        } else if (
          error instanceof CrewError &&
          error.reason === "invalid_session"
        ) {
          clearSession();
          router.replace(`/join?code=${code}`);
        } else {
          setStatus("error");
        }
      }
    };

    const wakeTimer = setTimeout(() => {
      setStatus((current) => (current === "connecting" ? "waking" : current));
    }, 4000);

    socket.on("crew:members", onMembers);
    socket.on("crew:position", onPosition);
    socket.on("crew:closed", onClosed);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", rejoin);
    rejoin();

    return () => {
      cancelled = true;
      clearTimeout(wakeTimer);
      socket.off("crew:members", onMembers);
      socket.off("crew:position", onPosition);
      socket.off("crew:closed", onClosed);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", rejoin);
    };
  }, [code, router]);

  const geoActive = status === "ready" && geoStatus !== "unsupported";

  useEffect(() => {
    if (!geoActive) return;
    const socket = getSocket();

    const watchId = navigator.geolocation.watchPosition(
      (fix) => {
        const point: GeoFix = {
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy: Number.isFinite(fix.coords.accuracy)
            ? Math.round(fix.coords.accuracy)
            : null,
        };
        setGeoStatus("granted");
        setOwnPosition(point);

        const sendState = sendStateRef.current;
        const nowMs = Date.now();
        const sinceMs = nowMs - sendState.sentAt;
        const movedM = sendState.sent
          ? distanceMeters(sendState.sent, point)
          : Infinity;
        if (
          (sinceMs >= MIN_SEND_GAP_MS && movedM >= MIN_MOVE_METERS) ||
          sinceMs >= HEARTBEAT_MS
        ) {
          sendState.sentAt = nowMs;
          sendState.sent = point;
          socket.volatile.emit("position:update", point);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setGeoStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [geoActive, geoRetry]);

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(ticker);
  }, []);

  function retryGeo() {
    setGeoStatus("pending");
    setGeoRetry((n) => n + 1);
  }

  return {
    status,
    members,
    memberId,
    connected,
    ownPosition,
    geoStatus,
    retryGeo,
    now,
  };
}
