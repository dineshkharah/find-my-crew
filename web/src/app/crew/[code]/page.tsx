"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CrewError,
  rejoinCrew,
  type Member,
  type PositionEvent,
} from "@/lib/crew";
import { sanitizeCodeInput } from "@/lib/crewCode";
import { distanceMeters, type GeoFix, type GeoPoint } from "@/lib/geo";
import { clearSession, loadSession } from "@/lib/session";
import { getSocket } from "@/lib/socket";

const CrewMap = dynamic(() => import("@/components/CrewMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
  ),
});

const MAX_MEMBERS = 10;
const MIN_SEND_GAP_MS = 2500;
const MIN_MOVE_METERS = 3;
const HEARTBEAT_MS = 10_000;

type Status = "connecting" | "waking" | "ready" | "ended" | "error";
type GeoStatus = "pending" | "granted" | "denied" | "unsupported";

export default function CrewPage(props: PageProps<"/crew/[code]">) {
  const { code: rawCode } = use(props.params);
  const code = sanitizeCodeInput(rawCode);

  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId] = useState(() => loadSession()?.memberId ?? null);
  const [connected, setConnected] = useState(true);
  const [copied, setCopied] = useState(false);
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

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      return;
    }
  }

  if (status === "connecting" || status === "waking") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          Connecting to your crew...
        </p>
        {status === "waking" && (
          <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Waking the server up, this can take a minute on the first visit...
          </p>
        )}
      </main>
    );
  }

  if (status === "ended") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">This crew has ended</h1>
        <p className="max-w-xs text-zinc-500 dark:text-zinc-400">
          Crews expire on their own once everyone has gone home.
        </p>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 font-semibold text-background"
        >
          Back to home
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Could not reach the server
        </h1>
        <p className="max-w-xs text-zinc-500 dark:text-zinc-400">
          Check your connection, then try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 font-semibold text-background"
        >
          Try again
        </button>
      </main>
    );
  }

  const sorted = [...members].sort((a, b) => {
    if (a.id === memberId) return -1;
    if (b.id === memberId) return 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const onlineCount = members.filter((member) => member.online).length;

  return (
    <main className="flex flex-1 flex-col items-center gap-5 px-4 py-6">
      {!connected && (
        <div className="w-full max-w-xl rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Reconnecting...
        </div>
      )}
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Crew code
        </p>
        <button
          onClick={copyCode}
          className="rounded-xl px-4 py-1 font-mono text-3xl font-bold tracking-[0.2em] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          title="Copy the code"
        >
          {code}
        </button>
        <p className="h-5 text-xs text-zinc-500 dark:text-zinc-400">
          {copied ? "Copied!" : "Tap the code to copy and share it"}
        </p>
      </header>
      <div className="relative h-[45dvh] w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <CrewMap
          members={members}
          meId={memberId}
          ownPosition={ownPosition}
          now={now}
        />
      </div>
      {geoStatus === "denied" && (
        <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-xl bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>Location is off, your crew can&apos;t see you.</span>
          <button
            onClick={() => {
              setGeoStatus("pending");
              setGeoRetry((n) => n + 1);
            }}
            className="shrink-0 rounded-full bg-amber-900 px-3 py-1 text-xs font-semibold text-amber-100 dark:bg-amber-200 dark:text-amber-950"
          >
            Retry
          </button>
        </div>
      )}
      {geoStatus === "pending" && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Waiting for your location...
        </p>
      )}
      <section className="flex w-full max-w-xl flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {members.length} of {MAX_MEMBERS} members, {onlineCount} online
        </h2>
        <ul className="flex flex-col gap-2">
          {sorted.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900"
            >
              <span className="text-2xl">{member.emoji}</span>
              <span className="flex-1 truncate font-medium">
                {member.name}
                {member.id === memberId && (
                  <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    you
                  </span>
                )}
              </span>
              {member.online ? (
                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  online
                </span>
              ) : (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatLastSeen(member.lastSeenAt, now)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function formatLastSeen(lastSeenAt: number | null, now: number): string {
  if (lastSeenAt === null) return "offline";
  const seconds = Math.max(0, Math.round((now - lastSeenAt) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `last seen ${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `last seen ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `last seen ${hours} h ago`;
}
