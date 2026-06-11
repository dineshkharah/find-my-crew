import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-6xl" aria-hidden>
          🧭
        </span>
        <h1 className="text-4xl font-bold tracking-tight">Find My Crew</h1>
        <p className="max-w-xs text-lg text-zinc-500 dark:text-zinc-400">
          Lost each other in the crowd? See your friends live and follow the
          arrow back to them.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-4">
        <Link
          href="/create"
          className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-semibold text-background transition-opacity hover:opacity-85"
        >
          Create a crew
        </Link>
        <Link
          href="/join"
          className="flex h-14 items-center justify-center rounded-full border border-zinc-300 text-lg font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Join a crew
        </Link>
      </div>
    </main>
  );
}
