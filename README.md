# Habit Tracker Frontend - Quick Start

This guide contains the basic configuration needed to run the frontend locally.

## 1. Prerequisites

Install these tools first:
- Node.js 18+
- npm 9+
- Expo Go app (optional, for physical device testing)
- Android Studio emulator or iOS simulator (optional)

You also need the backend API running (default expected URL: `http://localhost:8080`).

## 2. Install dependencies

From this folder (`habit-tracker-frontend`):

```bash
npm install
```

## 3. Configure environment variables

Create a local `.env` from the template:

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

Set API URL in `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8080
```

Choose the value depending on your target:
- Web or iOS simulator on same machine: `http://localhost:8080`
- Android emulator: `http://10.0.2.2:8080`
- Physical phone: `http://<YOUR_COMPUTER_LAN_IP>:8080` (example `http://192.168.1.10:8080`)

Important: if `EXPO_PUBLIC_API_URL` is missing, the app throws an error at startup.

## 4. Start the app

Run Expo development server:

```bash
npm run start
```

Optional platform commands:

```bash
npm run android
npm run ios
npm run web
```

## 5. Recommended startup order

1. Start backend infrastructure and backend API first.
2. Start frontend with Expo.
3. Open the app on your chosen platform.

## 6. Troubleshooting

- App cannot reach API:
  - Verify backend is running on port 8080.
  - Verify `EXPO_PUBLIC_API_URL` in `.env`.
  - For physical devices, make sure phone and computer are on the same network.

- Android emulator network issue:
  - Use `http://10.0.2.2:8080` instead of `localhost`.

- Changes to `.env` not applied:
  - Stop Expo and start it again.
