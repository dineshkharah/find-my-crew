"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CrewError,
  rejoinCrew,
  type Member,
  type PositionEvent,
} from "@/lib/crew";
import { distanceMeters, type GeoPoint } from "@/lib/geo";
import { loadPin, savePin, type MeetingPin } from "@/lib/pin";
import { clearSession, loadSession } from "@/lib/session";
import { getSocket } from "@/lib/socket";
import { useGeolocation, type GeoStatus } from "./useGeolocation";

const MIN_SEND_GAP_MS = 2500;
const MIN_MOVE_METERS = 3;
const HEARTBEAT_MS = 10_000;

export type CrewStatus = "connecting" | "waking" | "ready" | "ended" | "error";
export type { GeoStatus };

export type UseCrew = {
  status: CrewStatus;
  members: Member[];
  memberId: string | null;
  connected: boolean;
  ownPosition: ReturnType<typeof useGeolocation>["position"];
  geoStatus: GeoStatus;
  retryGeo: () => void;
  now: number;
  pin: MeetingPin | null;
  pinNotice: string | null;
  clearPinNotice: () => void;
  setMeetingPoint: (lat: number, lng: number) => void;
};

export function useCrew(code: string): UseCrew {
  const router = useRouter();
  const [status, setStatus] = useState<CrewStatus>("connecting");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId] = useState(() => loadSession()?.memberId ?? null);
  const [connected, setConnected] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [pin, setPin] = useState<MeetingPin | null>(() =>
    typeof window === "undefined" ? null : loadPin(code),
  );
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const prevPinRef = useRef<MeetingPin | null>(null);

  const geo = useGeolocation(true);
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
    const onPin = (next: MeetingPin) => {
      const hadPin = prevPinRef.current !== null;
      prevPinRef.current = next;
      setPin(next);
      savePin(code, next);
      if (next.setByMemberId !== session.memberId) {
        const verb = hadPin ? "moved" : "set";
        setPinNotice(`${next.setByEmoji} ${next.setByName} ${verb} the meeting point`);
      }
    };
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
        if (result.pin) {
          prevPinRef.current = result.pin;
          setPin(result.pin);
          savePin(code, result.pin);
        }
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
    socket.on("crew:pin", onPin);
    socket.on("crew:closed", onClosed);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", rejoin);
    rejoin();

    return () => {
      cancelled = true;
      clearTimeout(wakeTimer);
      socket.off("crew:members", onMembers);
      socket.off("crew:position", onPosition);
      socket.off("crew:pin", onPin);
      socket.off("crew:closed", onClosed);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", rejoin);
    };
  }, [code, router]);

  useEffect(() => {
    if (status !== "ready" || !geo.position) return;
    const socket = getSocket();
    const point = geo.position;
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
  }, [status, geo.position]);

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(ticker);
  }, []);

  const clearPinNotice = useCallback(() => setPinNotice(null), []);

  function setMeetingPoint(lat: number, lng: number) {
    getSocket().emit("pin:set", { lat, lng });
  }

  return {
    status,
    members,
    memberId,
    connected,
    ownPosition: geo.position,
    geoStatus: geo.status,
    retryGeo: geo.retry,
    now,
    pin,
    pinNotice,
    clearPinNotice,
    setMeetingPoint,
  };
}
