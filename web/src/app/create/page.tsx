"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import IdentityForm from "@/components/IdentityForm";
import { createCrew } from "@/lib/crew";
import type { Identity } from "@/lib/identity";
import { saveSession } from "@/lib/session";

type Status = "idle" | "creating" | "waking" | "error";

export default function CreateCrewPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");

  async function handleCreate(identity: Identity) {
    setStatus("creating");
    const wakeTimer = setTimeout(() => {
      setStatus((current) => (current === "creating" ? "waking" : current));
    }, 4000);
    try {
      const result = await createCrew(identity);
      saveSession({
        code: result.code,
        memberId: result.memberId,
        token: result.token,
      });
      router.push(`/crew/${result.code}`);
    } catch {
      setStatus("error");
    } finally {
      clearTimeout(wakeTimer);
    }
  }

  const busy = status === "creating" || status === "waking";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Create a crew</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          First, tell your crew who you are.
        </p>
      </div>
      <IdentityForm
        submitLabel={busy ? "Creating..." : "Create my crew"}
        onSubmit={handleCreate}
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
