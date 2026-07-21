# Architecture

## Style

Modular Monolith. Three layers:

```
Presentation (mobile app / admin web)
        ↓
Business Logic (Express controllers → services)
        ↓
Data Access (repositories → PostgreSQL)
```

The UI never talks to the database directly; every request goes through backend APIs.

## Backend Module Boundaries

Each feature is an independent module under `backend/src/modules/<name>/`:

```
auth/
users/
workers/
businesses/
staff/
booking/
orders/
notifications/
admin/
ratings/
reviews/
search/
verification/
audit-logs/
```

Each module contains:

```
routes.ts
controller.ts
service.ts
repository.ts
validation.ts
dto.ts
interfaces.ts
tests/
```

Modules communicate only through each other's service interfaces — never by reaching into another module's repository or internal state directly. This is the boundary that makes future microservice extraction possible without a rewrite.

## Frontend Structure (mobile/)

Feature-based, mirroring backend modules:

```
src/
  screens/        (auth, home, services, bazaar, user, worker, business, orders, booking, notifications, profile, settings, admin)
  components/     (shared: buttons, cards, inputs, dialogs, loaders, icons, GradientHeader)
  navigation/     RootNavigator (language + theme hydration gate → auth vs. app), AuthNavigator (stack),
                  AppNavigator (bottom tabs)
  services/       (API clients per module)
  hooks/
  state/          Zustand stores, incl. themeStore (theme mode, persisted)
  theme/          colors (brand-constant + light/dark palettes), useThemeColors hook, typography/fonts — Poppins app-wide
  localization/   (en, te)
  utils/
  constants/
  assets/
```

Post-login navigation is a bottom tab bar (`@react-navigation/bottom-tabs`): Home, Services, Bazaar, Profile. ("Bazaar" — the shop-ordering tab was originally named "Shoppify"; renamed to avoid trademark confusion with Shopify and because it reads more naturally in both English and Telugu, "బజార్". "Services" — originally a "Search" tab; the free-text search input lives on Home instead now, and this tab is for browsing by service category.) Every tab screen is topped by the shared `GradientHeader` component (brand gradient, currently `#0055D3` → `#1D76FA`, constant across themes) — new tabs/screens follow this same header pattern rather than each screen rolling its own. `GradientHeader` supports `showBack` (circular icon-only back button, used on Auth-stack screens instead of the platform-default header), `leadingIcon` (decorative icon beside the title — every tab has one, matching its tab-bar icon: compass for Home's brand header, concierge-bell/store/user for Services/Bazaar/Profile), `subtitle` (short tagline under the title — every tab has one, including Home, so no header is just a bare title), and `actions` (circular right-side icon buttons — Home has notifications and menu; messages was dropped). Title uses a semi-bold font weight — deliberately between the original bold and an earlier too-light medium pass. Services and Bazaar are placeholders until the Worker/Business search and shopping-list modules exist; Home's search bar and filter chips are UI-only for the same reason. Their content should replace the placeholder in place, not add new tabs, unless a product decision changes the tab set.

**Profile and Home are exceptions to the shared header**: both use their own wrapper (`ProfileHeader`, `HomeHeader`) instead of the generic per-tab `GradientHeader` config, because their menu icon needs local state (modal/drawer visibility) that a stateless header render function in `AppNavigator`'s `screenOptions`/`Tab.Screen options` can't hold. `ProfileHeader` wraps `GradientHeader` plus `ProfileMenuModal` (a bottom sheet — language/theme/logout, previously inline in the screen body). `HomeHeader` wraps `GradientHeader` plus `HomeMenuModal` (a right-side drawer — Worker/Business onboarding entry points plus theme/logout, modeled after a reference drawer-menu design: gradient header with an app icon, sectioned list of gradient-icon-square cards with title/subtitle/chevron, an app-settings section, and a footer). Any future screen needing header-triggered local UI (a menu, a popover) should follow this same wrapper-component pattern rather than trying to lift state into the navigator config — and pick bottom-sheet vs. side-drawer based on content shape (a handful of settings toggles vs. a scrollable list of navigation entries). Profile's body itself is role-gated: a static ratings/posts section shows only for `worker`/`business_owner`/`business_staff` accounts, not plain `user` accounts — this is placeholder content (no ratings/reviews or posts module exists yet) but the role check itself is real and should be reused, not re-implemented, when those modules land.

**Home's menu drawer** (`HomeMenuModal`) surfaces two entry points — "Are You a Worker?" and "Do You Have a Shop?" — opening `WorkerProfileModal`/`BusinessProfileModal` (full-screen forms: skill/shop category chips, experience or shop name, `LocationPicker`, `ImagePickerField`, submit) which add the respective capability to the current `user` account via `POST /workers/me/profile` / `POST /businesses/me/profile` — see the Account Model section below. These two forms use a left-side circular `chevron-left` back button in their header (not a right-side close "X") — they're full-screen forms, not a dismissible overlay, so backing out reads more correctly than closing does; matches `GradientHeader`'s own back button position/style elsewhere in the app. `HomeMenuModal` also carries an "App Settings" section (Language, Theme, Logout) so all three are reachable from Home too, not just Profile's own menu.

**Skill/category chips are multi-select, not single-select** in both `WorkerProfileModal` and `BusinessProfileModal` — a worker can have several skills, a shop can span several categories. Each fixed chip's active state is `array.includes(key)` toggled on press (add/remove from the array), not a single selected-key comparison. `BusinessProfileModal` additionally has a Yes/No delivery-availability chip pair; selecting "Yes" reveals a `deliveryPricePerKm` `TextField` (backend-required in that case). All of these fields are JSON-stringified (arrays) or stringified booleans/numbers client-side before being appended to the `FormData`, since multipart fields are all strings — see `backend/src/common/utils/parseMultipartField.ts`'s `parseJsonIfString`/`parseBooleanIfString` on the receiving end.

**The `"other"` chip is a tag-adder, not a toggle** — tapping it doesn't add the literal string `"other"` to the selected array directly; it opens an inline `TextField` + circular gradient "Done" button (`otherInputValue`/`showOtherInput` state). Confirming (the Done button or the keyboard's own `returnKeyType="done"`) pushes the typed text into a local `otherSkillEntries`/`otherCategoryEntries` array, clears the input, and closes it — tapping the `"other"` chip again reopens the input so a second (or third) custom entry can be added the same way. Each committed entry renders as its own small removable gradient chip appended after the fixed category chips (`array.includes` there doesn't apply — tapping one of these removes it by index instead, since it isn't one of the fixed keys). At submit time, if any custom entries exist, `"other"` is appended to the fixed-category array being sent and all entries are joined with `", "` into the single `otherSkillDescription`/`otherCategoryDescription` string the backend's `.refine()` validation expects (the backend has no concept of *multiple* other-entries — the join happens client-side). The fixed `"other"` chip itself renders active/inactive based on whether any custom entries exist, not on array membership like the other chips.

**Language, Theme, and Logout share dedicated modals across both menus**: `LanguagePickerModal` and `ThemePickerModal` (centered cards — gradient header, selectable option rows with a per-option gradient icon and a checkmark on the active one; `LanguagePickerModal` mirrors `ThemePickerModal`'s structure exactly) replace inline switcher pill rows in both `HomeMenuModal` and `ProfileMenuModal` — each now shows Language/Theme as a tappable row (icon, label, current value, chevron) instead. `LogoutConfirmModal` (centered card, red gradient icon circle, title/message, Cancel + red-gradient Logout buttons) gates the actual `useLogout()` call behind an explicit confirmation in both menus; the Logout trigger itself is a distinct red gradient (`#ef4444` → `#dc2626`) — a deliberate, intentional exception to the "every primary button uses the brand gradient" rule below, reserved for this one destructive action. `state/themeStore.ts` exports `themeModeLabelKey(mode)` and `state/settingsStore.ts` exports `languageLabelKey(language)` so both menus resolve the same "current value" label without duplicating the mapping.

**`ProfileMenuModal`, `ThemePickerModal`, and `LogoutConfirmModal` use the platform `Modal`'s built-in `animationType="fade"` plus `statusBarTranslucent`** — no custom `Animated`-driven transition, since none of them need a directional effect the built-in type can't express. **`HomeMenuModal` is the one exception**: it's a genuine slide-in drawer (per its reference design), which `animationType` has no built-in equivalent for, so it drives its own `Animated.timing` on `translateX`/backdrop opacity — but deliberately `timing`, not `spring`, for both open *and* close. The very first version of this drawer used a `spring` for its close animation; a spring has no fixed duration (it runs until it settles within a threshold, which can take an unpredictable extra beat), and since the native `Modal` stays mounted — and keeps swallowing all touches, including the header's own menu button — until that animation reports `finished`, an unpredictable spring-close made reopening the drawer right after closing intermittently feel broken. A fixed-duration `timing` (with `Easing.out(Easing.cubic)` for the deceleration feel) keeps the slide smooth while guaranteeing the Modal frees up input again after the same short, known window every time. Any new modal in this app should default to the platform's own `animationType`/`statusBarTranslucent`; reach for a custom `Animated` transition only when there's a concrete directional-motion requirement the built-in types can't express, and prefer `timing` over `spring` for anything that also needs to unblock touches promptly on close.

**Loading affordances all use one shared motif — dots orbiting a center point (`LoadingIndicator`)** — instead of the platform's generic `ActivityIndicator`. `LoadingIndicator` (`size`/`color`/`dotSize`/`duration` props) is what `Button`'s `loading` state renders, so every submit button in the app (Register/Login/Otp, etc.) picks it up automatically. **Logout gets a dedicated full-screen variant**: `authStore.isLoggingOut` (set in `useLogout()`'s `onMutate`, cleared in `onSettled` — after `clearSession()`, so `RootNavigator` has already swapped to the Auth stack by the time the overlay starts fading) drives `LogoutOverlay`, rendered from `App.tsx` as a sibling of `RootNavigator` so it draws above whichever navigator is mounted regardless of the swap happening underneath it. `isLoggingOut` is deliberately excluded from `authStore`'s persistence (`partialize`) — a stuck `true` surviving an app kill mid-request would otherwise show the overlay forever on next launch. `LogoutOverlay` composes a large `LoadingIndicator` (`size={96}`, `duration={1800}` — slower than the default 900ms, since a bigger ring spinning at the same speed reads as frantic) plus a pulsing center mark unique to this full-screen variant — logging out is the one transition where the whole screen is about to change underneath the user, so it earns its own full-screen beat rather than just a bigger version of the inline spinner alone.

**`WelcomeScreen`** (the Auth stack's entry point, and where logout always lands) is a full landing screen, not a bare button stack: a gradient hero panel (`headerGradient`, the same treatment `GradientHeader` uses — brand icon, app name, tagline) followed by a single "Create Account" `Button` and a plain text "Already have an account? Log In" link. It's deliberately **not** a role picker — every self-registered account is a plain `user` (see Account Model below), so there's no role choice to make here; an earlier version had three role-selection cards (Customer/Worker/Business) before that model was settled. It intentionally does **not** use the shared `ScreenContainer` (which applies a fixed `padding: 20` on all sides) — the hero panel needs to bleed edge-to-edge and up under the status bar the way `GradientHeader` does, so the screen composes its own `SafeAreaView`s directly instead.

**Icons**: `FontAwesome6` (`@expo/vector-icons`), not Ionicons — the free tier's icon set is mostly solid-only (no outline counterpart for `home`/`magnifying-glass`/`store`/`bars`/`arrow-left`/`screwdriver-wrench`), so active vs. inactive tab state is shown via color only (`colors.primary` vs `colors.textMuted`) — no background pill or per-icon glow indicator; an earlier pass added one but it ate into the tab label's vertical space and was removed. Solid vs. regular style is selected via a boolean prop (`solid`) matching the style name, same mechanism FA5 used — not an `iconStyle` string prop, despite an internal `FA6Style` const suggesting otherwise. Migrated from FA5 solely to get the `screwdriver-wrench` glyph (Services tab); FA6 also renamed a couple of glyphs used elsewhere in the app (`search` → `magnifying-glass`, `times` → `xmark`). The tab bar itself has a custom `tabBarBackground` (filled with `colors.surface`, not `colors.background`, so it reads as a distinct panel rather than blending into the screen content; the top edge is a gradient line with its own matching corner radius so it continues the tab bar's rounded corners rather than being hard-clipped — a native border can't be a gradient) and a custom `tabBarButton` (removes the default Android ripple / iOS press-opacity so selecting a tab shows no press-state background). Follow this same icon family and interaction pattern for any new tab or header icon, rather than mixing in a different icon set, reintroducing default press feedback, or adding a background/glow behind tab icons (it doesn't fit in the available vertical space alongside the label).

**Buttons**: the shared `Button` component and the active pill in `LanguageSwitcher`/`ThemePickerModal` all render the brand gradient as their background (via `LinearGradient`, since a `Pressable`/View can't have a gradient `backgroundColor` directly) — never a flat `colors.primary` fill. Any new primary-action control should follow this pattern for visual consistency. The one deliberate exception is Logout (`HomeMenuModal`/`ProfileMenuModal`'s trigger and `LogoutConfirmModal`'s confirm button), which uses a distinct red gradient (`#ef4444` → `#dc2626`) instead — a destructive/exit action, not a primary one, so it's intentionally visually distinct rather than blending in with every other button in the app. `Button` takes an optional `gradient` prop (defaulting to `headerGradient`) precisely so a screen with its own brand-distinct gradient header can keep its submit button visually consistent with that header instead of the app-wide blue — `BusinessProfileModal` passes its orange `SHOP_GRADIENT` (`#F59E0B` → `#D97706`, matching its own header) rather than introducing a separate flat-orange button style.

**Light/dark theme**: only `background`/`surface`/`text`/`textMuted`/`border` vary between `lightColors` and `darkColors` (`theme/colors.ts`, currently `#F9FCFF`/`#0c0f14` background/text swapped between the two) — brand colors (primary, secondary, success/warning/error, the header gradient) stay constant in both. Any component that renders one of the theme-dependent keys must read it from `useThemeColors()` inside the component body (so it re-renders on theme change), never from the static `colors` export — `StyleSheet.create()` at module scope can't be reactive, so theme-dependent values are applied via inline `style={[...]}` overrides, not baked into the stylesheet. `themeStore` only persists the user's choice (`system`/`light`/`dark`); `useThemeColors()` resolves `system` against the device's live scheme on every render.

`RootNavigator.tsx` also passes a `theme` to `<NavigationContainer>` built from `useThemeColors()` (based on React Navigation's own `DefaultTheme`/`DarkTheme`) — without this, React Navigation's hardcoded default (light) background shows through anywhere screen content doesn't fully cover it. Any future navigator added at the root level inherits this automatically; don't reintroduce a bare `<NavigationContainer>` without the `theme` prop.

**Status bar**: `App.tsx`'s `<StatusBar style="light" />` is hardcoded, not theme-reactive — every screen's persistent top chrome is the blue gradient header, so the status bar overlaying it needs light text/icons in both light and dark mode. Don't switch this back to `"auto"` without also removing/reworking the gradient header, since `"auto"` would make status bar text unreadable against the gradient whenever the in-app theme is light.

**Native chrome outside the React tree**: Android's edge-to-edge system navigation bar (and the native root window background it reveals) isn't part of the component tree at all — no amount of in-app `View`/`StyleSheet` styling reaches it. `App.tsx` syncs it explicitly on every theme change: `expo-system-ui`'s `SystemUI.setBackgroundColorAsync(colors.background)` (root window background — this is what a mismatched `NavigationContainer` theme was actually leaking through, not an Android rendering bug in the tab bar itself) and `expo-navigation-bar`'s `NavigationBar.setStyle(...)` (Android-only, nav bar icon color). Also: `app.json`'s `userInterfaceStyle` must stay `"automatic"`, not `"light"` — that setting locks the *native* Android appearance independent of `themeStore`'s in-app choice, which directly undermines the dark mode feature if ever changed back.

**`LocationPicker`** (`mobile/src/components/LocationPicker.tsx`) is "Use my current location" (`expo-location`'s `requestForegroundPermissionsAsync` → `getCurrentPositionAsync` → `reverseGeocodeAsync`, building a display address from `name`/`city`/`region`) with a manual `TextField` fallback. There's no map/pin-drop UI yet, so manual entry only ever produces an address string — `latitude`/`longitude` stay `null` until GPS actually succeeds; editing the address text after a successful GPS detect clears the coordinates too, since the text no longer necessarily matches them. Used by `RegisterScreen` and both `WorkerProfileModal`/`BusinessProfileModal`. Takes an optional `accentColor` prop (defaulting to `colors.primary`) for its "use current location" button's border/tint/icon color — `BusinessProfileModal` passes `SHOP_GRADIENT[0]` so this button matches its orange header instead of defaulting to brand blue, the same rationale as `Button`'s `gradient` prop above.

**`ImagePickerField`** (`mobile/src/components/ImagePickerField.tsx`) follows the pick-then-upload-on-submit flow proven in a sibling project: `expo-image-picker`'s `requestMediaLibraryPermissionsAsync` → `launchImageLibraryAsync` (gallery only, no camera) holds picked images as local URIs in component state for preview; the actual multipart upload only happens when the surrounding form is submitted (`workersService`/`businessesService` build a `FormData` with `{uri, name, type}` file objects — the shape React Native's `fetch` expects for a file entry, not a real `Blob`). `apiClient.postForm()` is the one place that sends a `FormData` body instead of JSON — deliberately never sets `Content-Type` itself, since `fetch` has to compute the multipart boundary from the `FormData` instance; setting that header manually breaks the upload.

## Account Model

Every self-registered account is a plain `user` — not one of an exclusive set of roles chosen at registration. **Worker and Business are optional capabilities** a `user` account can add, either during onboarding (Home menu → "Are You a Worker?"/"Do You Have a Shop?") or, in principle, at any later point — not an exclusive choice made once at signup. Adding a capability creates a linked `worker_profiles`/`business_profiles` row (backend modules `workers`/`businesses`, each owning its own table per the module-boundary rule above) whose own `id` is that capability's distinct identifier (worker_id / business_id) and whose own `verification_status` (`pending_verification` → `verified`/`rejected`) gates admin trust for that capability specifically — independent of `accounts.status`, which is `active` immediately for every self-registered account regardless of which capabilities it later gains. `business_staff` (an employee added by a business owner) and `admin` are unrelated to this model — provisioned differently, never self-registered. This superseded an earlier design where `role` was chosen once at registration (`user`/`worker`/`business_owner`) and Worker/Business accounts sat in `pending_verification` from the moment the account itself was created; `WelcomeScreen`'s three role-selection cards were removed accordingly (see above).

**Image uploads (Cloudinary)**: both `workers` and `businesses` modules' `POST .../me/profile` endpoints accept `multipart/form-data`, parsed by a shared `multer` instance (`backend/src/common/middleware/upload.ts` — disk storage to a temp dir, images only, 5MB/file limit) ahead of `validateBody` in the route chain (multer populates `req.body`/`req.files` first, which `zod` then validates — text fields all arrive as strings, so the `workers`/`businesses` validation schemas use `z.coerce` for anything numeric, unlike the JSON-body schemas elsewhere in the app). `backend/src/common/services/cloudinaryService.ts`'s `uploadToCloudinary(filePath, folder)` uploads to Cloudinary and always deletes the local temp file afterward, success or failure — mirrors a pattern already proven in a sibling project, but configured via this app's own `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` env vars (never hardcoded, never shared across projects); if they're unset, `uploadToCloudinary` throws a clear `CLOUDINARY_NOT_CONFIGURED` `AppError` rather than the server failing to boot at all.

## Auth Flow

1. Mobile number, email, and location entered → OTP sent.
2. OTP verified → account created (always `role: "user"`, `status: "active"` immediately) → logged in.
3. JWT access + refresh tokens issued.
4. Optionally, at any point: add Worker and/or Business capability (see Account Model above) — each starts `pending_verification` until admin approves, independent of the account itself.

## Authorization

Role-based: `user`, `worker`, `business_owner`, `business_staff`, `admin` (+ future admin sub-roles) — the enum is unchanged, but `worker`/`business_owner` are no longer assigned via self-registration (always `user`, see Account Model above); they remain in the type for any future non-self-registration assignment path. Every protected endpoint checks authentication (valid JWT) and authorization (role/permission) before executing business logic.

## Search Architecture

Area-based for MVP: users select village/town, workers/businesses define service areas — **however, full GPS coordinates are now captured at registration and for Worker/Business capability locations** (see Account Model above), a deliberate, confirmed override of the original "no live GPS in MVP" decision. Search itself is still area/village-town-based for now; the coordinates are captured and stored so radius-based search can build on them later without another migration. Search service is isolated behind an interface so that swap can happen without touching booking/order business logic.

## Verification (PIN) Architecture

```
Booking/Order created → backend generates unique single-use PIN → stored securely
    → customer shares PIN with worker/business staff → PIN submitted → backend verifies
    → status updates only on successful verification
```

Never SMS OTP for this step — in-app only, free, per-booking/per-order.

## Notification Architecture

Firebase Cloud Messaging via a dedicated `notifications` service — never triggered directly from controllers. Other modules call `notifications.service` to enqueue a send.

## Database

PostgreSQL, normalized. Core entities: accounts, otp_verifications, refresh_tokens, worker_profiles, business_profiles, business_staff, bookings, orders, order_items, notifications, reviews, ratings, verification_requests, audit_logs. Foreign keys enforce relationships; index mobile_number, email, skill_category, shop_category, service_area (and other frequently-filtered columns). Full DDL lives in `docs/database.md` / `database/migrations/`.

## Localization Architecture

Language is a core architectural concern, not a display-layer afterthought — see `docs/localization.md` for the full model. The load-bearing points for any module you build:

- `accounts.preferred_language` is the authoritative per-account language; local device storage is a convenience cache synced from it after login.
- APIs are language-independent — never branch business logic on language, never localize API `message`/error text server-side for the client to display. The mobile client maps `error.code` → localized string itself.
- Anything the backend composes and pushes to a user unprompted (notifications, admin announcements) *is* language-aware, but via per-language template lookups keyed by the recipient's `preferred_language` — not translation-on-the-fly.
- Reference/category data (worker professions, business categories) is stored as a stable language-independent code with per-language label lookups, never as translated strings that get re-translated for display.

## Future Microservices Migration

When a module needs independent scaling (e.g., Notifications or Search under load), extract it because:

- It already exposes a clean service-layer interface.
- It owns its own tables/repository (no cross-module direct queries).
- Its inter-module calls are already abstracted, so they become network calls (REST/queue) instead of in-process calls with minimal contract change.

No module should ever query another module's tables directly — this is the rule that keeps the split cheap later.
