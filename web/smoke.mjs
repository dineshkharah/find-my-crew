import { spawn } from "node:child_process";
import { io } from "socket.io-client";

const PORT = 4123;

const server = spawn(process.execPath, ["src/index.js"], {
  cwd: "c:/cc/find-my-crew/server",
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, PORT: String(PORT) },
});
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => {
    if (String(d).includes("listening")) resolve();
  });
  setTimeout(() => reject(new Error("server did not start")), 5000);
});

const URL = `http://localhost:${PORT}`;
const connect = () =>
  new Promise((resolve) => {
    const s = io(URL, { transports: ["websocket"] });
    s.on("connect", () => resolve(s));
  });
const call = (socket, event, payload) =>
  new Promise((resolve) =>
    socket
      .timeout(3000)
      .emit(event, payload, (err, res) =>
        resolve(err ? { ok: false, error: "timeout" } : res),
      ),
  );

let failures = 0;
const check = (name, cond) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
};

const a = await connect();
const created = await call(a, "crew:create", { name: "Dinesh", emoji: "🦖" });
check("create returns ok with one member", created.ok && created.members.length === 1);
check("code matches the AB23C4 pattern", /^[A-Z]{2}[2-9]{2}[A-Z][2-9]$/.test(created.code));
const code = created.code;

const b = await connect();
const bad = await call(b, "crew:join", { code: "ZZ99Z9", name: "Priya", emoji: "🐙" });
check("joining a wrong code returns not_found", bad.ok === false && bad.error === "not_found");

const aSawJoin = new Promise((r) => a.once("crew:members", r));
const joined = await call(b, "crew:join", { code, name: "Priya", emoji: "🐙" });
check("join returns ok with two members", joined.ok && joined.members.length === 2);
const listAfterJoin = await aSawJoin;
check("creator received the join broadcast", listAfterJoin.length === 2);
check("broadcast does not leak tokens", listAfterJoin.every((m) => !("token" in m)));

const aSawOffline = new Promise((r) => a.once("crew:members", r));
b.disconnect();
const listAfterDrop = await aSawOffline;
const priya = listAfterDrop.find((m) => m.id === joined.memberId);
check(
  "disconnect marks member offline with timestamp",
  priya && priya.online === false && typeof priya.lastSeenAt === "number",
);

const b2 = await connect();
const badToken = await call(b2, "crew:rejoin", {
  code,
  memberId: joined.memberId,
  token: "wrong",
});
check("rejoin with a wrong token is rejected", badToken.ok === false && badToken.error === "invalid_session");

const rejoined = await call(b2, "crew:rejoin", {
  code,
  memberId: joined.memberId,
  token: joined.token,
});
check(
  "rejoin with the right token resumes identity",
  rejoined.ok && rejoined.members.find((m) => m.id === joined.memberId)?.online === true,
);

const aSawPosition = new Promise((r) => a.once("crew:position", r));
b2.emit("position:update", { lat: 18.5204, lng: 73.8567, accuracy: 12 });
const position = await aSawPosition;
check(
  "position update reaches the crew",
  position.memberId === joined.memberId &&
    position.lat === 18.5204 &&
    position.lng === 73.8567 &&
    position.accuracy === 12 &&
    typeof position.at === "number",
);

const invalidOutcome = await new Promise((resolve) => {
  const onPosition = () => resolve("broadcast");
  a.once("crew:position", onPosition);
  b2.emit("position:update", { lat: 999, lng: 73.8567 });
  setTimeout(() => {
    a.off("crew:position", onPosition);
    resolve("ignored");
  }, 400);
});
check("invalid position is ignored", invalidOutcome === "ignored");

const extras = [];
for (let i = 0; i < 8; i++) {
  const s = await connect();
  extras.push(s);
  const res = await call(s, "crew:join", { code, name: `Friend${i}`, emoji: "🐸" });
  check(`member ${i + 3} of 10 can join`, res.ok === true);
  if (i === 0) {
    const seen = res.members.find((m) => m.id === joined.memberId);
    check("join snapshot includes stored positions", seen?.position?.lat === 18.5204);
  }
}
const eleventh = await connect();
const overflow = await call(eleventh, "crew:join", { code, name: "Latecomer", emoji: "🦀" });
check("eleventh member is rejected as full", overflow.ok === false && overflow.error === "full");

for (const s of [a, b2, eleventh, ...extras]) s.disconnect();
server.kill();
console.log(failures ? `${failures} CHECKS FAILED` : "ALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
