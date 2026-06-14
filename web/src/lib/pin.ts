export type MeetingPin = {
  lat: number;
  lng: number;
  setByName: string;
  setByEmoji: string;
  setByMemberId: string;
  at: number;
};

function keyFor(code: string): string {
  return `fmc.pin.${code}`;
}

export function loadPin(code: string): MeetingPin | null {
  try {
    const raw = localStorage.getItem(keyFor(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      typeof parsed.at === "number"
    ) {
      return parsed as MeetingPin;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePin(code: string, pin: MeetingPin) {
  try {
    localStorage.setItem(keyFor(code), JSON.stringify(pin));
  } catch {
    return;
  }
}
