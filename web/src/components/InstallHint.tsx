"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fmc.installHintDismissed";

export default function InstallHint() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!promptEvent) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setPromptEvent(null);
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    dismiss();
  }

  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex-1 text-left text-zinc-600 dark:text-zinc-300">
        Add Find My Crew to your home screen so it is one tap away in the crowd.
      </span>
      <button
        onClick={install}
        className="shrink-0 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background"
      >
        Add
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 text-xs text-zinc-400"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
