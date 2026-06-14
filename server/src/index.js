import http from "node:http";
import crypto from "node:crypto";
import express from "express";
import { Server } from "socket.io";
import { generateCrewCode, isValidCrewCode } from "./crewCode.js";

const PORT = process.env.PORT ?? 4000;

const MAX_MEMBERS = 10;
const MAX_NAME_LENGTH = 14;
const EMPTY_CREW_TTL = 60 * 60 * 1000;
const CREW_MAX_AGE = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL = 60 * 1000;

const crews = new Map();

const app = express();

app.get("/health", (req, res) => {
  res.json({ ok: true, crews: crews.size });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.WEB_ORIGIN ?? true },
});

function membersPayload(crew) {
  return [...crew.members.values()].map((member) => ({
    id: member.id,
    name: member.name,
    emoji: member.emoji,
    online: member.online,
    lastSeenAt: member.lastSeenAt,
    position: member.position,
  }));
}

function broadcastMembers(crew) {
  io.to(crew.code).emit("crew:members", membersPayload(crew));
}

function cleanIdentity(payload) {
  const name =
    typeof payload?.name === "string"
      ? payload.name.trim().slice(0, MAX_NAME_LENGTH)
      : "";
  const emoji =
    typeof payload?.emoji === "string" ? payload.emoji.trim().slice(0, 8) : "";
  if (!name || !emoji) return null;
  return { name, emoji };
}

function markOffline(crew, member) {
  member.online = false;
  member.lastSeenAt = Date.now();
  if (![...crew.members.values()].some((m) => m.online)) {
    crew.lastEmptyAt = Date.now();
  }
}

function detach(socket) {
  const crew = crews.get(socket.data.crewCode);
  const member = crew?.members.get(socket.data.memberId);
  socket.data.crewCode = undefined;
  socket.data.memberId = undefined;
  if (!crew || !member) return;
  socket.leave(crew.code);
  markOffline(crew, member);
  broadcastMembers(crew);
}

function attach(socket, crew, member) {
  if (socket.data.crewCode && socket.data.crewCode !== crew.code) {
    detach(socket);
  }
  socket.data.crewCode = crew.code;
  socket.data.memberId = member.id;
  socket.join(crew.code);
  member.online = true;
  member.lastSeenAt = null;
  crew.lastEmptyAt = null;
}

function addMember(crew, socket, identity) {
  const member = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(24).toString("hex"),
    name: identity.name,
    emoji: identity.emoji,
    online: true,
    lastSeenAt: null,
    position: null,
  };
  crew.members.set(member.id, member);
  attach(socket, crew, member);
  return member;
}

io.on("connection", (socket) => {
  socket.on("crew:create", (payload, ack) => {
    if (typeof ack !== "function") return;
    const identity = cleanIdentity(payload);
    if (!identity) return ack({ ok: false, error: "bad_request" });

    let code = generateCrewCode();
    while (crews.has(code)) code = generateCrewCode();

    const crew = {
      code,
      createdAt: Date.now(),
      lastEmptyAt: null,
      members: new Map(),
      pin: null,
    };
    crews.set(code, crew);
    const member = addMember(crew, socket, identity);

    ack({
      ok: true,
      code,
      memberId: member.id,
      token: member.token,
      members: membersPayload(crew),
      pin: crew.pin,
    });
  });

  socket.on("crew:join", (payload, ack) => {
    if (typeof ack !== "function") return;
    const identity = cleanIdentity(payload);
    const code =
      typeof payload?.code === "string" ? payload.code.toUpperCase() : "";
    if (!identity || !isValidCrewCode(code)) {
      return ack({ ok: false, error: "bad_request" });
    }

    const crew = crews.get(code);
    if (!crew) return ack({ ok: false, error: "not_found" });
    if (crew.members.size >= MAX_MEMBERS) {
      return ack({ ok: false, error: "full" });
    }

    const member = addMember(crew, socket, identity);
    ack({
      ok: true,
      code,
      memberId: member.id,
      token: member.token,
      members: membersPayload(crew),
      pin: crew.pin,
    });
    broadcastMembers(crew);
  });

  socket.on("crew:rejoin", (payload, ack) => {
    if (typeof ack !== "function") return;
    const code =
      typeof payload?.code === "string" ? payload.code.toUpperCase() : "";

    const crew = crews.get(code);
    if (!crew) return ack({ ok: false, error: "not_found" });

    const member = crew.members.get(payload?.memberId);
    if (!member || member.token !== payload?.token) {
      return ack({ ok: false, error: "invalid_session" });
    }

    attach(socket, crew, member);
    ack({ ok: true, code, members: membersPayload(crew), pin: crew.pin });
    broadcastMembers(crew);
  });

  socket.on("position:update", (payload) => {
    const crew = crews.get(socket.data.crewCode);
    const member = crew?.members.get(socket.data.memberId);
    if (!crew || !member) return;

    const lat = Number(payload?.lat);
    const lng = Number(payload?.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return;
    const rawAccuracy = Number(payload?.accuracy);
    const accuracy =
      Number.isFinite(rawAccuracy) && rawAccuracy >= 0
        ? Math.round(rawAccuracy)
        : null;

    member.position = { lat, lng, accuracy, at: Date.now() };
    socket
      .to(crew.code)
      .volatile.emit("crew:position", {
        memberId: member.id,
        ...member.position,
      });
  });

  socket.on("pin:set", (payload) => {
    const crew = crews.get(socket.data.crewCode);
    const member = crew?.members.get(socket.data.memberId);
    if (!crew || !member) return;

    const lat = Number(payload?.lat);
    const lng = Number(payload?.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return;

    crew.pin = {
      lat,
      lng,
      setByName: member.name,
      setByEmoji: member.emoji,
      setByMemberId: member.id,
      at: Date.now(),
    };
    io.to(crew.code).emit("crew:pin", crew.pin);
  });

  socket.on("disconnect", () => {
    const crew = crews.get(socket.data.crewCode);
    const member = crew?.members.get(socket.data.memberId);
    if (!crew || !member) return;
    markOffline(crew, member);
    broadcastMembers(crew);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const crew of crews.values()) {
    const tooOld = now - crew.createdAt > CREW_MAX_AGE;
    const longEmpty =
      crew.lastEmptyAt !== null && now - crew.lastEmptyAt > EMPTY_CREW_TTL;
    if (tooOld || longEmpty) {
      io.to(crew.code).emit("crew:closed");
      io.in(crew.code).socketsLeave(crew.code);
      crews.delete(crew.code);
    }
  }
}, SWEEP_INTERVAL);

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
