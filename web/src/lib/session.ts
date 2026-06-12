export type CrewSession = {
  code: string;
  memberId: string;
  token: string;
};

const STORAGE_KEY = "fmc.session";

export function loadSession(): CrewSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.code === "string" &&
      typeof parsed.memberId === "string" &&
      typeof parsed.token === "string"
    ) {
      return { code: parsed.code, memberId: parsed.memberId, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: CrewSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
