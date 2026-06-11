"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import IdentityForm from "@/components/IdentityForm";
import { generateCrewCode } from "@/lib/crewCode";

export default function CreateCrewPage() {
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Create a crew</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          First, tell your crew who you are.
        </p>
      </div>
      <IdentityForm
        submitLabel="Create my crew"
        onSubmit={() => {
          router.push(`/crew/${generateCrewCode()}`);
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
