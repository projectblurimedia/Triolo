# Partner App (Triolo Partner)

React Native (Expo) + TypeScript client — the Worker/Business-facing app. Same backend, same account model as `../user-app`'s (see `../.cloud/project-context.md`'s "Account Model") — a phone number registered here is the *same account* as in the consumer app, just reached through a capability-first flow instead of an optional Home-menu afterthought.

A standalone Expo project, not a shared monorepo package with `user-app` — see `.cloud/architecture.md` for why (no workspace tooling exists in this repo yet; duplicating a handful of proven, generic components was the lower-risk choice for this pass). Most of its infrastructure (theme, `apiClient`, auth store, toast/loading motifs, `LocationPicker`/`ImagePickerField`, the auth OTP screens) is a direct, unmodified copy of `user-app`'s own — if you fix a bug or improve one of those in either app, check whether the other needs the same fix.

## Setup

```bash
npm install
npm start          # Expo dev server (scan QR with Expo Go, or press a/i/w)
npm run android
npm run ios
npm run web
npm run typecheck
```

The app expects the backend running locally at the same address `user-app` uses (see `src/constants/config.ts`) — update `API_BASE_URL` the same way.

## Structure

```
src/
  screens/
    auth/         Welcome, Register, Login, Otp — same flow as user-app's, no first-launch
                   language picker or inline language switcher (kept minimal for this pass)
    capability/    ChooseCapability, WorkerRegistration, BusinessRegistration, MyInfo
  components/     Button, TextField, ScreenContainer, LoadingIndicator, LocationPicker,
                  ImagePickerField, GradientHeader, ConfirmModal, VerificationBadge,
                  ToastHost, LogoutOverlay — all copied verbatim from user-app
  navigation/     RootNavigator (auth hydration gate → auth vs. main), AuthNavigator (stack),
                  MainNavigator (stack, not tabs — this app has no multi-section product to
                  tab between)
  services/       apiClient, authService, workersService, businessesService — copied verbatim
  hooks/          useAuthMutations, useWorkerMutations, useBusinessMutations — copied verbatim
  state/          authStore, themeStore, settingsStore, toastStore — copied verbatim
  theme/          copied verbatim from user-app
  localization/   en.json, te.json — trimmed to what this app actually shows (auth,
                  worker/business registration, capability chooser, my-info, shared errors)
  constants/      config (API base URL)
```

## What's implemented

Full registration/login flow (same backend Auth module user-app uses) → `ChooseCapabilityScreen` (fetches `GET /workers/me/profile` and `GET /businesses/me/profile`; shows a card per capability — not-yet-registered opens that capability's registration screen, already-registered opens a read-only `MyInfoScreen`) → `WorkerRegistrationScreen`/`BusinessRegistrationScreen` (adapted from user-app's `WorkerProfileModal`/`BusinessProfileModal` — same fields, same multi-select category chips + "+ Add New" pattern, same shared `LocationPicker`/`ImagePickerField`, submitting to the same `POST .../me/profile` endpoints) → `MyInfoScreen` (read-only view of the submitted profile, per "just show my info for now" — no edit/delete yet).

## What's not yet implemented

Edit/delete on `MyInfoScreen` (the backend `PATCH`/`DELETE .../me/profile` endpoints already exist and are proven by user-app — wiring them here is a natural, low-risk follow-up once this lands). First-launch language picker and inline language switcher (device locale still drives en/te automatically; an account's saved `preferredLanguage` still overrides it on login). Distinct app icon/branding assets (currently reuses `user-app`'s placeholder icons — see `assets/`). Not yet run on a real device/emulator.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly.
