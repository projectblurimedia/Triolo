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
  screens/        auth/ (LanguageSelect, Welcome, Register, Login, Otp), home/ (Home), services/ (Services),
                  bazaar/ (Bazaar), profile/ (Profile)
  components/     Button, TextField, ScreenContainer, LanguageSwitcher, ThemePickerModal, LogoutConfirmModal,
                  GradientHeader, ProfileHeader, ProfileMenuModal, HomeHeader, HomeMenuModal
  navigation/     RootNavigator (language + theme hydration gate → auth vs. app), AuthNavigator (stack),
                  AppNavigator (bottom tabs)
  services/       apiClient (fetch wrapper, auto access-token refresh on 401), authService
  hooks/          React Query mutations wrapping authService
  state/          Zustand stores: authStore (session, persisted), settingsStore (language, persisted),
                  themeStore (theme mode: system/light/dark, persisted)
  theme/          colors (brand-constant + light/dark palettes), useThemeColors hook, typography (Poppins), fonts
  localization/   i18next setup, en.json, te.json, errorMessages (error.code → localized string)
  constants/      config (API base URL)
```

## What's implemented

Full registration/login flow against the backend Auth module: role selection → OTP request → OTP verify → session persisted (AsyncStorage). Access-token refresh on 401 is wired in `apiClient`.

**Post-login app shell**: a 4-tab bottom navigator (Home, Services, Bazaar, Profile) via `@react-navigation/bottom-tabs`, each screen topped with a `GradientHeader` (brand gradient `#0055D3` → `#1D76FA`, see `theme/colors.ts`). ("Bazaar" — the shop-ordering tab was originally named "Shoppify"; renamed to avoid trademark confusion with Shopify, and it translates naturally to Telugu, "బజార్", unlike "Shoppify". "Services" — originally a "Search" tab; the free-text search input moved to Home, and this tab is now for browsing by service category instead.) Services and Bazaar are placeholders until the Worker/Business search and shopping-list modules are built. Home is a dashboard greeting plus a search bar and filter chips (not wired to anything real yet). Tab icons via `@expo/vector-icons` (`FontAwesome6`, solid glyphs — the free tier has no outline counterpart for most of these).

**Home menu**: the header's menu icon opens `HomeMenuModal`, a right-side drawer (matching a reference drawer design, fades in/out via the platform `Modal`'s own `animationType="fade"` + `statusBarTranslucent`) with two entry points — "Become a Worker" and "Become a Business". Neither navigates anywhere yet (both show a localized "coming soon" alert) since upgrading an already-registered `user` account to Worker/Business isn't supported by the backend yet — registration today only branches by role at initial sign-up. The drawer also has an "App Settings" section (Theme + Logout, reusing the same shared modals Profile's menu uses). `HomeHeader` (holding the drawer's visibility state) wraps `GradientHeader` the same way `ProfileHeader` does for its own menu.

**Profile**: the account card (avatar initial in a brand-gradient circle, name/mobile/role/status) is the focus of the screen body. Worker and business accounts (`worker`/`business_owner`/`business_staff`) additionally see a static ratings summary and a "Recent Work" row of placeholder post cards — plain `user` accounts see neither, since they don't apply. Language, theme, and logout moved out of the main body entirely — Profile's header has its own menu icon (`ProfileHeader`, not the shared per-tab header) that opens `ProfileMenuModal`, a bottom sheet holding `LanguageSwitcher`, a tappable Theme row (opens `ThemePickerModal`), and a red-gradient Logout button (opens `LogoutConfirmModal` before actually logging out), keeping the main screen focused on the account/profile itself.

**Theme & Logout**: `ThemePickerModal` (centered card — gradient header, three selectable option rows each with a per-option gradient icon and a checkmark on the active one) is a shared component reused by both `HomeMenuModal` and `ProfileMenuModal`, both of which show Theme as a tappable row (icon, label, current value, chevron) rather than an inline switcher. `LogoutConfirmModal` (centered card, red gradient icon circle, Cancel + red-gradient Logout buttons) is likewise shared, gating the actual `useLogout()` call behind explicit confirmation in both menus. `state/themeStore.ts` exports `themeModeLabelKey(mode)` so both menus resolve the same "current value" label without duplicating the mapping.

**Home search**: a search input (`home.searchPlaceholder`) and four toggleable filter chips (Services, Shops, Top Rated, Nearby — local UI state only, not wired to a real search yet) sit below the greeting, styled consistently with the rest of the app (active chip uses the brand gradient, same as `LanguageSwitcher`/`Button`).

**Tab bar**: rounded top corners (30) with a thicker gradient line as the top edge, its own corners rounded to match the tab bar's rather than being hard-clipped square (a native border can't be a gradient, so this is a custom `tabBarBackground`) — filled with `colors.surface`, not `colors.background`, so it reads as a distinct panel rather than blending into the screen content. Active/inactive is color-only (`colors.primary` vs `colors.textMuted`, no background pill or glow — an earlier glow-indicator pass ate into the label's vertical space and got removed). Default Android ripple / iOS press-opacity feedback removed (`tabBarButton` override) so selecting a tab shows no press-state background.

**Header**: `GradientHeader` supports an optional circular icon-only back button (`showBack`, used on Register/Login/Otp — replaces React Navigation's default plain header), a decorative `leadingIcon` (every tab has one, matching its tab-bar icon), an optional `subtitle` (short tagline under the title — every tab has one now, including Home, so no header is just a bare title), and circular right-side action icons (Home has notifications and menu — currently inert placeholders; messages was dropped), plus a bottom accent line that sits flush with the header's actual bottom edge. Title/subtitle use explicit `lineHeight` to keep the gap between them tight rather than relying on the font's default line spacing. Title uses a semi-bold weight — bolder than the initial minimal pass, but lighter than the original bold. Icons are `FontAwesome6`, matching the tab bar. All Auth-stack screens use this branded header instead of the platform-default one.

**Theme (light/dark)**: `theme/colors.ts` defines brand-constant colors (primary, secondary, success/warning/error, white) that never change, and separate `lightColors`/`darkColors` palettes for `background`/`surface`/`text`/`textMuted`/`border` (light: `#F9FCFF`/`#0c0f14` background/text; dark: `#0c0f14`/`#F9FCFF` — inverse of each other by design). `useThemeColors()` resolves the active palette against `themeStore`'s `mode` (`system`/`light`/`dark`, persisted) and the device's live color scheme when `mode === 'system'`. `ThemePickerModal` lets the user pick between the three (see "Theme & Logout" above) — the active pill in `LanguageSwitcher`, and the shared `Button` component, render the brand gradient as their background rather than a flat color (Logout is the one deliberate exception — a distinct red gradient, not the brand one, since it's a destructive action). Poppins (`@expo-google-fonts/poppins`, loaded via `useFonts` in `App.tsx` with a held splash screen — Google Sans itself isn't publicly licensed for third-party apps, so Poppins was chosen as the closest available alternative) is the app-wide font family regardless of theme, applied centrally through `theme/typography.ts`.

**Theme reaches the native chrome too**: `RootNavigator.tsx` builds a `theme` for `<NavigationContainer>` from `useThemeColors()` — without it, React Navigation's own hardcoded light default shows through anywhere screen content doesn't fully cover it. `App.tsx` also syncs `expo-system-ui` (`SystemUI.setBackgroundColorAsync`) and `expo-navigation-bar` (`NavigationBar.setStyle`, Android only) with the resolved theme, since Android's edge-to-edge system navigation bar isn't part of the React view tree at all — no in-app styling can reach it, only these native APIs can. `app.json`'s `userInterfaceStyle` is `"automatic"` (not `"light"`) so the native Android appearance itself isn't locked against the in-app theme choice.

**Localization** (see `../docs/localization.md`): first-launch language picker (gates the whole app until confirmed), language re-selectable during registration (sent as `preferredLanguage` with the registration request), language switch in Profile that both updates the UI immediately and syncs to the account via `PATCH /auth/me/language`. On login, the account's saved `preferredLanguage` overrides local device state — logging into a new device follows the account, not the device locale. No component displays a raw API error message: `error.code` is mapped to a localized string via `src/localization/errorMessages.ts`, falling back to a generic localized message for unmapped codes.

## What's not yet implemented

Everything past Auth: real User/Worker/Business profile screens, search, booking, shopping list/orders, notifications, admin — Services and Bazaar tabs are placeholders, and Home's search bar/filters are UI-only, until those modules land. Home's notification/menu header icons have no destination yet. Only English and Telugu exist; the architecture (enum-based language type, per-key resource files) supports adding more without touching business logic, per `docs/localization.md`.

Telugu strings in `src/localization/te.json` were machine-translated for scaffolding purposes, aiming for plain everyday register rather than formal/literary Telugu — have a native speaker review them before shipping.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly — confirms all module resolution (`@/` aliases via babel-plugin-module-resolver), navigation, state, theme, and i18n wiring is correct.
- Grepped for any remaining static (non-theme-aware) use of theme-dependent color keys (`background`/`text`/`textMuted`/`surface`/`border`) — none found outside the theme system's own internals.
- Not yet run on a real device/emulator — do that before considering the tab bar / gradient header / dark mode / fonts production-verified (web export only proves the bundle builds, not real-device rendering, and dark mode in particular needs eyes on an actual device).
