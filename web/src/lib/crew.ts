import { getSocket } from "./socket";
import type { Identity } from "./identity";
import type { CrewSession } from "./session";

export type MemberPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: number;
};

export type Member = {
  id: string;
  name: string;
  emoji: string;
  online: boolean;
  lastSeenAt: number | null;
  position: MemberPosition | null;
};

export type PositionEvent = MemberPosition & { memberId: string };

export class CrewError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "CrewError";
  }
}

const CALL_TIMEOUT = 45000;

type Ack = { ok: boolean; error?: string };

function call<T>(event: string, payload: unknown): Promise<T> {
  const socket = getSocket();
  return new Promise((resolve, reject) => {
    socket
      .timeout(CALL_TIMEOUT)
      .emit(event, payload, (err: Error | null, res: (Ack & T) | undefined) => {
        if (err) return reject(new CrewError("unreachable"));
        if (!res?.ok) return reject(new CrewError(res?.error ?? "unknown"));
        resolve(res);
      });
  });
}

type JoinResult = {
  code: string;
  memberId: string;
  token: string;
  members: Member[];
};

export function createCrew(identity: Identity): Promise<JoinResult> {
  return call<JoinResult>("crew:create", identity);
}

export function joinCrew(code: string, identity: Identity): Promise<JoinResult> {
  return call<JoinResult>("crew:join", { code, ...identity });
}

export function rejoinCrew(
  session: CrewSession,
): Promise<{ code: string; members: Member[] }> {
  return call<{ code: string; members: Member[] }>("crew:rejoin", session);
}
