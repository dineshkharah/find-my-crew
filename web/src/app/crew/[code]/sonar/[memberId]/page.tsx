"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCrew } from "@/hooks/useCrew";
import { useCompass } from "@/hooks/useCompass";
import { useWakeLock } from "@/hooks/useWakeLock";
import { sanitizeCodeInput } from "@/lib/crewCode";
import {
  averagePoint,
  bearingDegrees,
  cardinal,
  distanceMeters,
  formatDistance,
  type GeoPoint,
} from "@/lib/geo";

const CLOSE_METERS = 15;
const AGING_MS = 15_000;
const LOST_MS = 10 * 60_000;
const SMOOTH_SAMPLES = 5;

type Freshness = "fresh" | "aging" | "lost";

export default function SonarPage(
  props: PageProps<"/crew/[code]/sonar/[memberId]">,
) {
  const { code: rawCode, memberId: targetId } = use(props.params);
  const code = sanitizeCodeInput(rawCode);

  const { status, members, ownPosition, now } = useCrew(code);
  const compass = useCompass();
  useWakeLock(status === "ready");

  const recentRef = useRef<GeoPoint[]>([]);
  const [me, setMe] = useState<GeoPoint | null>(null);
  useEffect(() => {
    if (!ownPosition) return;
    const buffer = recentRef.current;
    buffer.push({ lat: ownPosition.lat, lng: ownPosition.lng });
    if (buffer.length > SMOOTH_SAMPLES) buffer.shift();
    setMe(averagePoint(buffer));
  }, [ownPosition]);

  const target = members.find((member) => member.id === targetId) ?? null;
  const targetPos = target?.position ?? null;

  const distance = me && targetPos ? distanceMeters(me, targetPos) : null;
  const bearing = me && targetPos ? bearingDegrees(me, targetPos) : null;
  const ageMs = targetPos ? Math.max(0, now - targetPos.at) : null;
  const freshness: Freshness =
    ageMs === null || ageMs < AGING_MS
      ? "fresh"
      : ageMs < LOST_MS
        ? "aging"
        : "lost";
  const isClose = distance !== null && distance < CLOSE_METERS;

  const targetRotation =
    bearing === null ? null : bearing - (compass.heading ?? 0);
  const [displayAngle, setDisplayAngle] = useState(0);
  const [prevRotation, setPrevRotation] = useState<number | null>(null);
  if (targetRotation !== null && targetRotation !== prevRotation) {
    setPrevRotation(targetRotation);
    const delta = ((targetRotation - displayAngle + 540) % 360) - 180;
    setDisplayAngle(displayAngle + delta);
  }

  const wasCloseRef = useRef(false);
  useEffect(() => {
    if (isClose && !wasCloseRef.current) {
      navigator.vibrate?.(200);
    }
    wasCloseRef.current = isClose;
  }, [isClose]);

  const back = (
    <Link
      href={`/crew/${code}`}
      className="absolute left-4 top-4 z-10 flex h-10 items-center gap-1 rounded-full bg-zinc-100 px-4 text-sm font-semibold dark:bg-zinc-900"
    >
      &larr; Crew
    </Link>
  );

  if (status === "ended") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">This crew has ended</h1>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 font-semibold text-background"
        >
          Back to home
        </Link>
      </main>
    );
  }

  if (status !== "ready") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          Connecting to your crew...
        </p>
      </main>
    );
  }

  if (!target) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {back}
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          That crew member is not here.
        </p>
      </main>
    );
  }

  const heading = (
    <div className="flex flex-col items-center gap-1">
      <span className="text-5xl">{target.emoji}</span>
      <h1 className="text-2xl font-bold tracking-tight">{target.name}</h1>
    </div>
  );

  if (!targetPos) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {back}
        {heading}
        <p className="max-w-xs text-zinc-500 dark:text-zinc-400">
          No location for {target.name} yet. They need to open the app and allow
          location.
        </p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {back}
        {heading}
        <p className="max-w-xs text-zinc-500 dark:text-zinc-400">
          Finding your location...
        </p>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-between px-6 py-16 text-center">
      {back}
      {heading}

      <div className="flex flex-col items-center gap-6">
        {isClose ? (
          <div className="relative flex h-56 w-56 items-center justify-center">
            <span className="absolute h-40 w-40 animate-ping rounded-full bg-green-400/40" />
            <span className="absolute h-40 w-40 rounded-full bg-green-400/20" />
            <span className="text-4xl">{target.emoji}</span>
          </div>
        ) : (
          <div
            className={`flex h-56 w-56 items-center justify-center transition-opacity ${
              freshness === "fresh" ? "opacity-100" : "opacity-40"
            }`}
          >
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full transition-transform duration-300 ease-out"
              style={{ transform: `rotate(${displayAngle}deg)` }}
            >
              <path
                d="M50 6 L74 84 L50 68 L26 84 Z"
                className="fill-foreground"
              />
            </svg>
          </div>
        )}

        {isClose ? (
          <p className="text-2xl font-bold">
            You&apos;re close, look around for {target.emoji} {target.name}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="text-4xl font-bold tracking-tight">
              {formatDistance(distance ?? 0)}
            </p>
            {bearing !== null && (
              <p className="text-lg text-zinc-500 dark:text-zinc-400">
                {cardinal(bearing)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-16 flex-col items-center gap-2">
        {freshness === "aging" && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            last seen {Math.round((ageMs ?? 0) / 1000)} s ago
          </p>
        )}
        {freshness === "lost" && (
          <p className="max-w-xs text-sm text-amber-600 dark:text-amber-400">
            Lost signal, this was their last known spot.
          </p>
        )}
        {compass.status === "needs-permission" && (
          <button
            onClick={compass.enable}
            className="flex h-11 items-center justify-center rounded-full bg-foreground px-6 font-semibold text-background"
          >
            Point me
          </button>
        )}
        {compass.status !== "active" && compass.status !== "needs-permission" && (
          <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
            No compass here, the arrow points relative to north (up).
          </p>
        )}
      </div>
    </main>
  );
}
