"use client";

import { useState, useSyncExternalStore } from "react";
import { loadIdentity, saveIdentity, type Identity } from "@/lib/identity";

const EMOJIS = [
  "🦖",
  "🐙",
  "🦊",
  "🐼",
  "🐸",
  "🦄",
  "🐯",
  "🦁",
  "🐨",
  "🐵",
  "🦉",
  "🦋",
  "🐢",
  "🦈",
  "🐳",
  "🦜",
  "🐝",
  "🦀",
  "🐺",
  "🐰",
];

const MAX_NAME_LENGTH = 14;

type Props = {
  submitLabel: string;
  onSubmit: (identity: Identity) => void;
};

const emptySubscribe = () => () => {};

export default function IdentityForm(props: Props) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!isClient) return null;
  return <IdentityFormFields {...props} />;
}

function IdentityFormFields({ submitLabel, onSubmit }: Props) {
  const [saved] = useState(loadIdentity);
  const [name, setName] = useState(saved?.name ?? "");
  const [emoji, setEmoji] = useState(saved?.emoji ?? "");
  const [showHint, setShowHint] = useState(false);

  const trimmedName = name.trim();
  const ready = trimmedName.length > 0 && emoji !== "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) {
      setShowHint(true);
      return;
    }
    const identity = { name: trimmedName, emoji };
    saveIdentity(identity);
    onSubmit(identity);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-6">
      <label className="flex flex-col gap-2 text-left">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Your name
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Your name"
          className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 text-lg outline-none focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
        />
      </label>
      <div className="flex flex-col gap-2 text-left">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Your emoji
        </span>
        <div className="grid grid-cols-5 gap-2">
          {EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(option)}
              aria-pressed={emoji === option}
              className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition-colors ${
                emoji === option
                  ? "bg-zinc-200 ring-2 ring-zinc-900 dark:bg-zinc-800 dark:ring-zinc-100"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {showHint && !ready && (
        <p className="text-sm text-red-500">Pick a name and an emoji first.</p>
      )}
      <button
        type="submit"
        className="flex h-14 items-center justify-center rounded-full bg-foreground text-lg font-semibold text-background transition-opacity hover:opacity-85"
      >
        {submitLabel}
      </button>
    </form>
  );
}
