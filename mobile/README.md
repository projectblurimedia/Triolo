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
  screens/        auth/ (LanguageSelect, Welcome, Register, Login, Otp), home/ (Home)
  components/     Button, TextField, ScreenContainer, LanguageSwitcher
  navigation/     RootNavigator (language gate → auth vs. app stack), AuthNavigator, AppNavigator
  services/       apiClient (fetch wrapper, auto access-token refresh on 401), authService
  hooks/          React Query mutations wrapping authService
  state/          Zustand stores: authStore (session, persisted), settingsStore (language, persisted)
  theme/          colors, typography
  localization/   i18next setup, en.json, te.json, errorMessages (error.code → localized string)
  constants/      config (API base URL)
```

## What's implemented

Full registration/login flow against the backend Auth module: role selection → OTP request → OTP verify → session persisted (AsyncStorage) → home screen. Access-token refresh on 401 is wired in `apiClient`.

**Localization** (see `../docs/localization.md`): first-launch language picker (gates the whole app until confirmed), language re-selectable during registration (sent as `preferredLanguage` with the registration request), language switch in Settings/Home that both updates the UI immediately and syncs to the account via `PATCH /auth/me/language`. On login, the account's saved `preferredLanguage` overrides local device state — logging into a new device follows the account, not the device locale. No component displays a raw API error message: `error.code` is mapped to a localized string via `src/localization/errorMessages.ts`, falling back to a generic localized message for unmapped codes.

## What's not yet implemented

Everything past Auth: User/Worker/Business profile screens, search, booking, shopping list/orders, notifications, admin. Only English and Telugu exist; the architecture (enum-based language type, per-key resource files) supports adding more without touching business logic, per `docs/localization.md`.

Telugu strings in `src/localization/te.json` were machine-translated for scaffolding purposes, aiming for plain everyday register rather than formal/literary Telugu — have a native speaker review them before shipping.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly (565 modules) — confirms all module resolution (`@/` aliases via babel-plugin-module-resolver), navigation, state, and i18n wiring is correct.
- Grepped for hardcoded user-visible strings post-localization-pass — none found outside intentional empty header titles.
- Not yet run on a real device/emulator or against a live backend + Postgres instance — do that before considering the flow production-verified.
