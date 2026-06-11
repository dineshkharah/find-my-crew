export type Identity = {
  name: string;
  emoji: string;
};

const STORAGE_KEY = "fmc.identity";

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.name === "string" && typeof parsed.emoji === "string") {
      return { name: parsed.name, emoji: parsed.emoji };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    return;
  }
}
