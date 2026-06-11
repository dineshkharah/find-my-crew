"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import IdentityForm from "@/components/IdentityForm";
import { isValidCrewCode, sanitizeCodeInput } from "@/lib/crewCode";

export default function JoinCrewPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");

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
            setCodeError("");
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
        submitLabel="Join the crew"
        onSubmit={() => {
          if (!isValidCrewCode(code)) {
            setCodeError("That code does not look right, it should look like AB23C4.");
            return;
          }
          router.push(`/crew/${code}`);
        }}
      />
      <Link
        href="/"
        className="text-sm text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        Back to home
      </Link>
    </main>
  );
}
