# Momentum — Mobile (Expo / React Native)

A native iOS/Android client for the Task Manager (Momentum) backend. Talks to the
same FastAPI API as the web app.

## What's in this MVP

- Email/password **auth** (login + register), JWT stored in the device secure store.
- **Tasks** tab — workspace switcher, task list, one-tap status advance, snooze,
  pull-to-refresh.
- **Now** tab — the "What should I do now?" suggestion engine (pick energy + time).
- **New** tab — create a task (title, priority, energy, estimate, due quick-pick).
- **Task detail** — change status, snooze, delete.

Not yet ported from web: projects, members/assignment, comments, GitHub issue,
calendar subscription, weekly review/capacity. The backend already supports them.

## Prerequisites

- Node 18+, the [Expo Go](https://expo.dev/go) app on your phone (or an Android/iOS
  emulator), and the backend running (`docker compose up -d` in the repo root).

## Configure the API URL

The app reads the backend URL from `app.json` → `expo.extra.apiBaseUrl`.
`localhost` from the phone/emulator does **not** reach your computer, so set it to
whatever the device can reach:

| Running on | Set `apiBaseUrl` to |
|------------|---------------------|
| Android emulator | `http://10.0.2.2:8000` (default) |
| iOS simulator | `http://localhost:8000` |
| Physical phone (Expo Go) | `http://<your-computer-LAN-IP>:8000` (e.g. `http://192.168.1.20:8000`) |

Also make sure the backend CORS/`FRONTEND_URL` allows the origin if you hit auth
from a browser; the native app itself isn't subject to CORS.

## Run

```bash
cd mobile
npm install
npx expo start
```

Then scan the QR with Expo Go, or press `a` (Android) / `i` (iOS) for an emulator.

> If `npm install` complains about peer versions, run `npx expo install --fix`
> to align React Native / Expo package versions to this SDK.
