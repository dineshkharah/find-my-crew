# Find My Crew

Find your friends in a big crowd. Create a crew, share a short code, and everyone sees each other live on a map. Pick a friend and a full screen SONAR arrow points the way with the live distance, like "140 m, NE".

Built for concerts, conventions, and festivals, the places where groups get split up and phones are the only way back to each other.

**Live demo:** https://find-my-crew-app.vercel.app

Open it on a phone with a friend for the full effect. The first load can take around 30 seconds while the free server wakes up.

## What it does

- **Crews with a short code.** One person creates a crew and gets a 6 character code like `KF38R7`. Friends pick a name and an emoji, type the code, and join. No accounts, no sign up.
- **Live map.** Everyone in the crew shows up as an emoji dot that moves in real time, with honest "last seen 40 s ago" labels when someone goes quiet.
- **SONAR mode.** Choose a friend and the screen becomes a big arrow that points at them as you turn your phone, with the rounded distance and compass direction. Under 15 m it switches to a "you're close, look around" pulse, because GPS cannot tell you apart at that range.
- **Meeting point pin.** Drop a shared pin like "the main gate" or "the car". The arrow can point to it with no internet at all, the crew's escape hatch when the venue network dies.
- **Installable.** Add it to your home screen and it runs full screen like a native app, and it opens offline.

## How it works, honestly

This is a web app, so it uses the phone's GPS and compass rather than special hardware. That is roughly 5 to 10 m accurate and works while the app is open, which is framed as the product story: keep the app open in the crowd.

Your own location and heading work fully offline, because GPS is satellites and the compass is a magnetometer, neither needs the internet. Only seeing your friends move needs a connection, and those updates are tiny, so the target is "works on barely any connection" rather than perfectly offline. The meeting point pin is the fully offline piece: once it is saved on your phone, the arrow to it needs no server.

## Tech stack

- **Web app:** Next.js (App Router) with TypeScript and Tailwind, built as an installable PWA.
- **Realtime server:** Node with Express and Socket.io, holding crews in memory.
- **Map:** Leaflet with OpenStreetMap tiles.
- **Location and heading:** the browser geolocation and device orientation APIs.

## Architecture

The project is two parts that deploy separately:

- `web/` is the whole user interface and deploys to a static or serverless host.
- `server/` is the realtime hub and deploys to an always on host.

They are split because Socket.io needs one process that stays running for hours, holding every phone's connection open and keeping all the crews in memory. A serverless host cannot do that, so the realtime server lives on its own. The web app finds it through a single environment variable.

## Getting started

### Prerequisites

- Node 20 or newer
- Two terminals, one for the server and one for the web app

### 1. Start the realtime server

```bash
cd server
npm install
npm run dev
```

It listens on `http://localhost:4000`. Visit `http://localhost:4000/health` to check it is up.

### 2. Start the web app

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`.

### Testing on a real phone

GPS and the compass need HTTPS off localhost, so to test on your phone over the same WiFi:

```bash
cd web
npm run dev:https
```

Then open the printed network address on your phone and accept the local certificate.

## Environment variables

The web app reads one variable to find the realtime server:

- `NEXT_PUBLIC_SERVER_URL`: the full URL of the deployed server, for example `https://your-server.onrender.com`. When it is not set, the app connects to the same origin, which is what local development uses through a dev proxy.

## Privacy

Everything is ephemeral by design. There is no database and no accounts. Crews live only in the server's memory, codes expire after a few hours, and a crew disappears on its own once everyone has left. Closing the tab removes you after a short timeout. The only thing stored on your phone is your chosen name, your emoji, and the last meeting point, all in local storage so the app can remember you and point offline.

## Limitations

- It works while the app is open. The web platform cannot track location with the screen locked, so the honest rule is to keep it open in the crowd.
- GPS is 5 to 10 m accurate, so the arrow gets you close and your eyes do the last few meters.
- The free server sleeps when idle, so the first connection can take around 30 seconds to wake it, shown as a friendly waking state.
