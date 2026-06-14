"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCrew } from "@/hooks/useCrew";
import { useCopyCode } from "@/hooks/useCopyCode";
import { sanitizeCodeInput } from "@/lib/crewCode";

const CrewMap = dynamic(() => import("@/components/CrewMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
  ),
});

const MAX_MEMBERS = 10;

type PendingPick = { lat: number; lng: number };

export default function CrewPage(props: PageProps<"/crew/[code]">) {
  const { code: rawCode } = use(props.params);
  const code = sanitizeCodeInput(rawCode);

  const {
    status,
    members,
    memberId,
    connected,
    ownPosition,
    geoStatus,
    retryGeo,
    now,
    pin,
    pinNotice,
    clearPinNotice,
    setMeetingPoint,
  } = useCrew(code);
  const { copied, copyCode } = useCopyCode(code);

  const [menuOpen, setMenuOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmAt, setConfirmAt] = useState<PendingPick | null>(null);

  useEffect(() => {
    if (!pinNotice) return;
    const timer = setTimeout(clearPinNotice, 4000);
    return () => clearTimeout(timer);
  }, [pinNotice, clearPinNotice]);

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

  function useMyLocation() {
    setMenuOpen(false);
    if (!ownPosition) return;
    if (pin) {
      setConfirmAt({ lat: ownPosition.lat, lng: ownPosition.lng });
    } else {
      setMeetingPoint(ownPosition.lat, ownPosition.lng);
    }
  }

  function startPicking() {
    setMenuOpen(false);
    setPicking(true);
  }

  function confirmPin() {
    if (confirmAt) setMeetingPoint(confirmAt.lat, confirmAt.lng);
    setConfirmAt(null);
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-5 px-4 py-6">
      {!connected && (
        <div className="w-full max-w-xl rounded-xl bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Reconnecting...
        </div>
      )}
      {pinNotice && (
        <div className="w-full max-w-xl rounded-xl bg-blue-100 px-4 py-2 text-center text-sm font-medium text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          {pinNotice}
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
          pin={pin}
          picking={picking}
          onPickLocation={(lat, lng) => {
            setPicking(false);
            setConfirmAt({ lat, lng });
          }}
        />
        {picking && (
          <div className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-zinc-900/90 px-4 py-2 text-sm font-medium text-white">
            Tap the spot for the meeting point
          </div>
        )}
      </div>

      <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            📍 {pin ? "Move meeting point" : "Set meeting point"}
          </button>
          {menuOpen && (
            <div className="absolute left-1/2 top-12 z-[1000] flex w-56 -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <button
                onClick={useMyLocation}
                disabled={!ownPosition}
                className="px-4 py-3 text-left text-sm hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-900"
              >
                Use my current location
              </button>
              <button
                onClick={startPicking}
                className="border-t border-zinc-200 px-4 py-3 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Pick on the map
              </button>
            </div>
          )}
        </div>
        {pin && (
          <Link
            href={`/crew/${code}/sonar/pin`}
            className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background"
          >
            🧭 Head to meeting point
          </Link>
        )}
      </div>

      {geoStatus === "denied" && (
        <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-xl bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>Location is off, your crew can&apos;t see you.</span>
          <button
            onClick={retryGeo}
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
          {sorted.map((member) => {
            const isMe = member.id === memberId;
            const navigable = !isMe && member.position !== null;
            const row = (
              <>
                <span className="text-2xl">{member.emoji}</span>
                <span className="flex-1 truncate font-medium">
                  {member.name}
                  {isMe && (
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
              </>
            );
            if (navigable) {
              return (
                <li key={member.id}>
                  <Link
                    href={`/crew/${code}/sonar/${member.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    {row}
                    <span className="text-xl" aria-hidden>
                      🧭
                    </span>
                  </Link>
                </li>
              );
            }
            return (
              <li
                key={member.id}
                className={`flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900 ${
                  isMe ? "" : "opacity-60"
                }`}
              >
                {row}
                {!isMe && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    no location
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {confirmAt && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-zinc-950">
            <h3 className="text-lg font-bold">
              {pin ? "Replace the meeting point?" : "Set the meeting point here?"}
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {pin
                ? `This replaces the spot set by ${pin.setByEmoji} ${pin.setByName} ${formatAgo(pin.at, now)}.`
                : "Everyone in the crew will see this spot and can head to it."}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmAt(null)}
                className="flex h-11 flex-1 items-center justify-center rounded-full border border-zinc-300 font-semibold dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmPin}
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-foreground font-semibold text-background"
              >
                {pin ? "Replace" : "Set it"}
              </button>
            </div>
          </div>
        </div>
      )}
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

function formatAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} h ago`;
}
