# Mobile

React Native (Expo) + TypeScript client. Feature-based structure — see `../.cloud/architecture.md`.

## Setup

```bash
npm install
npm start          # Expo dev server (scan QR with Expo Go, or press a/i/w)
npm run android
npm run ios
npm run web
npm run typecheck
```

The app expects the backend running locally at `http://localhost:4000` (see `src/constants/config.ts`). Update `API_BASE_URL` per environment before staging/production builds.

## Structure

```
src/
  screens/        auth/ (Welcome, Register, Login, Otp), home/ (Home)
  components/     Button, TextField, ScreenContainer
  navigation/      RootNavigator (auth vs. app stack, driven by auth state), AuthNavigator, AppNavigator
  services/       apiClient (fetch wrapper, auto access-token refresh on 401), authService
  hooks/          React Query mutations wrapping authService
  state/          Zustand stores: authStore (session, persisted), settingsStore (language, persisted)
  theme/          colors, typography
  localization/   i18next setup, en.json, te.json
  constants/      config (API base URL)
```

## What's implemented

Full registration/login flow against the backend Auth module: role selection → OTP request → OTP verify → session persisted (AsyncStorage) → home screen. Language switch between English and Telugu, persisted across restarts. Access-token refresh on 401 is wired in `apiClient`.

## What's not yet implemented

Everything past Auth: User/Worker/Business profile screens, search, booking, shopping list/orders, notifications, admin. Telugu strings in `src/localization/te.json` were machine-translated for scaffolding purposes — have a native speaker review them before shipping.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly (562 modules) — confirms all module resolution (`@/` aliases via babel-plugin-module-resolver), navigation, state, and i18n wiring is correct.
- Not yet run on a real device/emulator or against a live backend + Postgres instance — do that before considering the flow production-verified.
