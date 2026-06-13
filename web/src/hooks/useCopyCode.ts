"use client";

import { useState } from "react";

export function useCopyCode(code: string) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      return;
    }
  }

  return { copied, copyCode };
}
