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

The app expects the backend running locally at `http://localhost:4000` (see `src/constants/config.ts`). Update `API_BASE_URL` per environment before staging/production builds — and to your PC's LAN IP instead of `localhost` when testing on a physical device via Expo Go.

## Structure

```
src/
  screens/        auth/ (LanguageSelect, Welcome, Register, Login, Otp), home/ (Home), search/ (Search),
                  shoppify/ (Shoppify), profile/ (Profile)
  components/     Button, TextField, ScreenContainer, LanguageSwitcher, GradientHeader
  navigation/     RootNavigator (language gate → auth vs. app), AuthNavigator (stack), AppNavigator (bottom tabs)
  services/       apiClient (fetch wrapper, auto access-token refresh on 401), authService
  hooks/          React Query mutations wrapping authService
  state/          Zustand stores: authStore (session, persisted), settingsStore (language, persisted)
  theme/          colors (brand gradient), typography (Poppins), fonts
  localization/   i18next setup, en.json, te.json, errorMessages (error.code → localized string)
  constants/      config (API base URL)
```

## What's implemented

Full registration/login flow against the backend Auth module: role selection → OTP request → OTP verify → session persisted (AsyncStorage). Access-token refresh on 401 is wired in `apiClient`.

**Post-login app shell**: a 4-tab bottom navigator (Home, Search, Shoppify, Profile) via `@react-navigation/bottom-tabs`, each screen topped with a `GradientHeader` (brand gradient `#0055D3` → `#1D76FA`, see `theme/colors.ts`). Search and Shoppify are placeholders until the Worker/Business search and shopping-list modules are built. Profile holds the account card, language switcher, and logout (moved out of Home, which is now a plain dashboard greeting). Tab icons via `@expo/vector-icons` (Ionicons), active/inactive states.

**Theme**: Poppins (`@expo-google-fonts/poppins`, loaded via `useFonts` in `App.tsx` with a held splash screen — Google Sans itself isn't publicly licensed for third-party apps, so Poppins was chosen as the closest available alternative) is now the app-wide font family, applied centrally through `theme/typography.ts` — no component sets its own font.

**Localization** (see `../docs/localization.md`): first-launch language picker (gates the whole app until confirmed), language re-selectable during registration (sent as `preferredLanguage` with the registration request), language switch in Settings/Profile that both updates the UI immediately and syncs to the account via `PATCH /auth/me/language`. On login, the account's saved `preferredLanguage` overrides local device state — logging into a new device follows the account, not the device locale. No component displays a raw API error message: `error.code` is mapped to a localized string via `src/localization/errorMessages.ts`, falling back to a generic localized message for unmapped codes.

## What's not yet implemented

Everything past Auth: real User/Worker/Business profile screens, search, booking, shopping list/orders, notifications, admin — Search and Shoppify tabs are placeholders until those modules land. Only English and Telugu exist; the architecture (enum-based language type, per-key resource files) supports adding more without touching business logic, per `docs/localization.md`.

Telugu strings in `src/localization/te.json` were machine-translated for scaffolding purposes, aiming for plain everyday register rather than formal/literary Telugu — have a native speaker review them before shipping.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly (736 modules) — confirms all module resolution (`@/` aliases via babel-plugin-module-resolver), navigation, state, theme, and i18n wiring is correct.
- Grepped for hardcoded user-visible strings post-localization-pass — none found outside intentional empty header titles.
- Not yet run on a real device/emulator — do that before considering the tab bar / gradient header / fonts production-verified (web export only proves the bundle builds, not real-device rendering).
