# Partner App (Triolo Partner)

React Native (Expo) + TypeScript client — the Worker/Business-facing app. Same backend, same account model as `../user-app`'s (see `../.cloud/project-context.md`'s "Account Model") — a phone number registered here is the *same account* as in the consumer app, just reached through a capability-first flow instead of an optional Home-menu afterthought.

A standalone Expo project, not a shared monorepo package with `user-app` — see `.cloud/architecture.md` for why (no workspace tooling exists in this repo yet; duplicating a handful of proven, generic components was the lower-risk choice for this pass). Most of its infrastructure (theme, `apiClient`, auth store, toast/loading motifs, `LocationPicker`/`ImagePickerField`, the auth OTP screens, `themeStore`/`settingsStore`) is a direct, unmodified copy of `user-app`'s own — if you fix a bug or improve one of those in either app, check whether the other needs the same fix. `CustomTabBar`, `ThemePickerModal`, and `LanguagePickerModal` are likewise direct ports of `user-app`'s own components.

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
    main/          Home, Bookings, Earnings, Profile — the verified-partner tab shell
  components/     Button, TextField, ScreenContainer, LoadingIndicator, LocationPicker,
                  ImagePickerField, GradientHeader, ConfirmModal, VerificationBadge,
                  ToastHost, LogoutOverlay — all copied verbatim from user-app; CustomTabBar,
                  ThemePickerModal, LanguagePickerModal are ports of user-app's own;
                  SettingsMenuModal is adapted from user-app's ProfileMenuModal (shared
                  across every tab here, not Profile-only)
  navigation/     RootNavigator (auth hydration gate → auth vs. main), AuthNavigator (stack),
                  MainNavigator (stack: ChooseCapability/registration screens, plus a MainTabs
                  screen once a capability is verified), MainTabNavigator (bottom tabs — Home/
                  Bookings/Earnings/Profile, unlocked once verified, rendered by CustomTabBar)
  services/       apiClient, authService, workersService, businessesService — copied verbatim
  hooks/          useAuthMutations, useWorkerMutations, useBusinessMutations — copied verbatim
  state/          authStore, themeStore, settingsStore, toastStore — copied verbatim
  theme/          copied verbatim from user-app
  localization/   en.json, te.json — trimmed to what this app actually shows (auth,
                  worker/business registration, capability chooser, my-info, shared errors)
  constants/      config (API base URL)
```

## What's implemented

Full registration/login flow (same backend Auth module user-app uses) → `ChooseCapabilityScreen` (fetches `GET /workers/me/profile` and `GET /businesses/me/profile`; shows a card per capability — not-yet-registered opens that capability's registration screen, already-registered opens `MyInfoScreen`) → `WorkerRegistrationScreen`/`BusinessRegistrationScreen` (adapted from user-app's `WorkerProfileModal`/`BusinessProfileModal` — same fields, same multi-select category chips + "+ Add New" pattern, same shared `LocationPicker`/`ImagePickerField`, both using the same brand-blue gradient as everything else in this app — no orange "shop" styling here, unlike user-app's Business *capability* identity) → `MyInfoScreen`.

`MyInfoScreen` is no longer read-only — a `pen` action in its own header opens the same registration screen in **edit mode** (an optional `route.params.profile`, mirroring user-app's `WorkerProfileModal`/`BusinessProfileModal` edit-mode branch exactly): prefilled fields, `PATCH` instead of `POST`, add/remove photos via the same `ImagePickerField`, and a `ConfirmModal`-gated Delete action.

Once a Worker or Business capability's `verificationStatus` reaches `verified`, the app unlocks `MainTabNavigator` — Home/Bookings/Earnings/Profile, using the same floating-pill `CustomTabBar` as user-app — instead of leaving the person on `MyInfoScreen` with nothing else to do. `Home`/`Bookings`/`Earnings` are honest placeholders (`Bookings`/`Earnings` chosen specifically to map to already-planned modules — the booking/order-flow pipeline and the post-MVP worker earnings dashboard — rather than a generic unexplained tab). `Profile` shows a gradient identity banner, a summary card per capability (with a quick fact — experience years / shop name — plus its `VerificationBadge`, linking into `MyInfoScreen`), and a prompt to add whichever capability is missing. `MyInfoScreen` itself also has a matching gradient hero banner with its info grouped into shadowed cards. Every tab header carries a `bars` menu action opening `SettingsMenuModal` — language, theme, and logout, all ported/adapted from user-app.

## What's not yet implemented

Real data behind `Home`/`Bookings`/`Earnings` (all depend on the Worker/Business module remainder — availability, search, booking/order flow, PIN verification — and payments, still pending per `.cloud/project-context.md`'s roadmap). First-launch language picker (device locale still drives en/te automatically; an account's saved `preferredLanguage` still overrides it on login, and the language can now be changed anytime via the header's Settings menu). Distinct app icon/branding assets (currently reuses `user-app`'s placeholder icons — see `assets/`). Not yet run on a real device/emulator.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly.
