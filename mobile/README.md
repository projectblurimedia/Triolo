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
  components/     Button, TextField, ScreenContainer, LanguageSwitcher, ThemeSwitcher, GradientHeader
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

**Post-login app shell**: a 4-tab bottom navigator (Home, Services, Bazaar, Profile) via `@react-navigation/bottom-tabs`, each screen topped with a `GradientHeader` (brand gradient `#0055D3` → `#1D76FA`, see `theme/colors.ts`). ("Bazaar" — the shop-ordering tab was originally named "Shoppify"; renamed to avoid trademark confusion with Shopify, and it translates naturally to Telugu, "బజార్", unlike "Shoppify". "Services" — originally a "Search" tab; the free-text search input moved to Home, and this tab is now for browsing by service category instead.) Services and Bazaar are placeholders until the Worker/Business search and shopping-list modules are built. Profile holds the account card, language switcher, theme switcher, and logout (moved out of Home, which is now a dashboard greeting plus a search bar and filter chips — also not wired to anything real yet). Tab icons via `@expo/vector-icons` (`FontAwesome5`, solid glyphs — the free tier has no outline counterpart for most of these).

**Home search**: a search input (`home.searchPlaceholder`) and four toggleable filter chips (Services, Shops, Top Rated, Nearby — local UI state only, not wired to a real search yet) sit below the greeting, styled consistently with the rest of the app (active chip uses the brand gradient, same as `LanguageSwitcher`/`ThemeSwitcher`/`Button`).

**Tab bar**: rounded top corners (30) with a thicker gradient line as the top edge, its own corners rounded to match the tab bar's rather than being hard-clipped square (a native border can't be a gradient, so this is a custom `tabBarBackground`) — filled with `colors.surface`, not `colors.background`, so it reads as a distinct panel rather than blending into the screen content. Active/inactive is color-only (`colors.primary` vs `colors.textMuted`, no background pill or glow — an earlier glow-indicator pass ate into the label's vertical space and got removed). Default Android ripple / iOS press-opacity feedback removed (`tabBarButton` override) so selecting a tab shows no press-state background.

**Header**: `GradientHeader` supports an optional circular icon-only back button (`showBack`, used on Register/Login/Otp — replaces React Navigation's default plain header), a decorative `leadingIcon` (every tab has one, matching its tab-bar icon), an optional `subtitle` (short tagline under the title — every tab has one now, including Home, so no header is just a bare title), and circular right-side action icons (Home has notifications and menu — currently inert placeholders; messages was dropped), plus a bottom accent line that sits flush with the header's actual bottom edge. Title/subtitle use explicit `lineHeight` to keep the gap between them tight rather than relying on the font's default line spacing. Title uses a semi-bold weight — bolder than the initial minimal pass, but lighter than the original bold. Icons are `FontAwesome5`, matching the tab bar. All Auth-stack screens use this branded header instead of the platform-default one.

**Theme (light/dark)**: `theme/colors.ts` defines brand-constant colors (primary, secondary, success/warning/error, white) that never change, and separate `lightColors`/`darkColors` palettes for `background`/`surface`/`text`/`textMuted`/`border` (light: `#F9FCFF`/`#0c0f14` background/text; dark: `#0c0f14`/`#F9FCFF` — inverse of each other by design). `useThemeColors()` resolves the active palette against `themeStore`'s `mode` (`system`/`light`/`dark`, persisted) and the device's live color scheme when `mode === 'system'`. `ThemeSwitcher` (Settings-style pill row, same pattern as `LanguageSwitcher`) lets the user pick between the three, from Profile — the active pill in both switchers, and the shared `Button` component (used for every primary action including Logout), all render the brand gradient as their background rather than a flat color. Poppins (`@expo-google-fonts/poppins`, loaded via `useFonts` in `App.tsx` with a held splash screen — Google Sans itself isn't publicly licensed for third-party apps, so Poppins was chosen as the closest available alternative) is the app-wide font family regardless of theme, applied centrally through `theme/typography.ts`.

**Localization** (see `../docs/localization.md`): first-launch language picker (gates the whole app until confirmed), language re-selectable during registration (sent as `preferredLanguage` with the registration request), language switch in Profile that both updates the UI immediately and syncs to the account via `PATCH /auth/me/language`. On login, the account's saved `preferredLanguage` overrides local device state — logging into a new device follows the account, not the device locale. No component displays a raw API error message: `error.code` is mapped to a localized string via `src/localization/errorMessages.ts`, falling back to a generic localized message for unmapped codes.

## What's not yet implemented

Everything past Auth: real User/Worker/Business profile screens, search, booking, shopping list/orders, notifications, admin — Services and Bazaar tabs are placeholders, and Home's search bar/filters are UI-only, until those modules land. Home's notification/menu header icons have no destination yet. Only English and Telugu exist; the architecture (enum-based language type, per-key resource files) supports adding more without touching business logic, per `docs/localization.md`.

Telugu strings in `src/localization/te.json` were machine-translated for scaffolding purposes, aiming for plain everyday register rather than formal/literary Telugu — have a native speaker review them before shipping.

## Verified

- `npx tsc --noEmit` passes.
- `npx expo export --platform web` bundles cleanly — confirms all module resolution (`@/` aliases via babel-plugin-module-resolver), navigation, state, theme, and i18n wiring is correct.
- Grepped for any remaining static (non-theme-aware) use of theme-dependent color keys (`background`/`text`/`textMuted`/`surface`/`border`) — none found outside the theme system's own internals.
- Not yet run on a real device/emulator — do that before considering the tab bar / gradient header / dark mode / fonts production-verified (web export only proves the bundle builds, not real-device rendering, and dark mode in particular needs eyes on an actual device).
