"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import IdentityForm from "@/components/IdentityForm";
import { joinCrew } from "@/lib/crew";
import {
  hasConfusableChars,
  isValidCrewCode,
  sanitizeCodeInput,
} from "@/lib/crewCode";
import type { Identity } from "@/lib/identity";
import { saveSession } from "@/lib/session";

type Status = "idle" | "joining" | "waking" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "No crew found with that code. Check it, or create a new crew.",
  full: "This crew is already full, 10 is the limit.",
};

export default function JoinCrewPage() {
  return (
    <Suspense fallback={null}>
      <JoinCrewForm />
    </Suspense>
  );
}

function JoinCrewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(() =>
    sanitizeCodeInput(searchParams.get("code") ?? ""),
  );
  const [codeError, setCodeError] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleJoin(identity: Identity) {
    if (!isValidCrewCode(code)) {
      setCodeError("That code is incomplete, a full code looks like AB23C4.");
      return;
    }
    setStatus("joining");
    const wakeTimer = setTimeout(() => {
      setStatus((current) => (current === "joining" ? "waking" : current));
    }, 4000);
    try {
      const result = await joinCrew(code, identity);
      saveSession({
        code: result.code,
        memberId: result.memberId,
        token: result.token,
      });
      router.push(`/crew/${result.code}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      const message = ERROR_MESSAGES[reason];
      if (message) {
        setCodeError(message);
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } finally {
      clearTimeout(wakeTimer);
    }
  }

  const busy = status === "joining" || status === "waking";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Join a crew</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Type the code your friend shared.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <input
          value={code}
          onChange={(event) => {
            setCode(sanitizeCodeInput(event.target.value));
            setCodeError(
              hasConfusableChars(event.target.value)
                ? "Codes never contain 0, O, 1, I or L, double check that character."
                : "",
            );
          }}
          placeholder="AB23C4"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-14 rounded-xl border border-zinc-300 bg-transparent text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
        />
        {codeError && <p className="text-sm text-red-500">{codeError}</p>}
      </div>
      <IdentityForm
        submitLabel={busy ? "Joining..." : "Join the crew"}
        onSubmit={handleJoin}
        busy={busy}
      />
      {status === "waking" && (
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Waking the server up, this can take a minute on the first visit...
        </p>
      )}
      {status === "error" && (
        <p className="max-w-xs text-sm text-red-500">
          Could not reach the server. Check your connection and try again.
        </p>
      )}
      <Link
        href="/"
        className="text-sm text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        Back to home
      </Link>
    </main>
  );
}
