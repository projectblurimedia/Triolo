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

**Icons**: `FontAwesome5` (`@expo/vector-icons`), not Ionicons — the free tier's icon set is mostly solid-only (no outline counterpart for `home`/`search`/`store`/`bars`/`arrow-left`/`concierge-bell`), so active vs. inactive tab state is shown via color only (`colors.primary` vs `colors.textMuted`) — no background pill or per-icon glow indicator; an earlier pass added one but it ate into the tab label's vertical space and was removed. The tab bar itself has a custom `tabBarBackground` (filled with `colors.surface`, not `colors.background`, so it reads as a distinct panel rather than blending into the screen content; the top edge is a gradient line with its own matching corner radius so it continues the tab bar's rounded corners rather than being hard-clipped — a native border can't be a gradient) and a custom `tabBarButton` (removes the default Android ripple / iOS press-opacity so selecting a tab shows no press-state background). Follow this same icon family and interaction pattern for any new tab or header icon, rather than mixing in a different icon set, reintroducing default press feedback, or adding a background/glow behind tab icons (it doesn't fit in the available vertical space alongside the label).

**Buttons**: the shared `Button` component and the active pill in `LanguageSwitcher`/`ThemeSwitcher` all render the brand gradient as their background (via `LinearGradient`, since a `Pressable`/View can't have a gradient `backgroundColor` directly) — never a flat `colors.primary` fill. Any new primary-action control should follow this pattern for visual consistency.

**Light/dark theme**: only `background`/`surface`/`text`/`textMuted`/`border` vary between `lightColors` and `darkColors` (`theme/colors.ts`, currently `#F9FCFF`/`#0c0f14` background/text swapped between the two) — brand colors (primary, secondary, success/warning/error, the header gradient) stay constant in both. Any component that renders one of the theme-dependent keys must read it from `useThemeColors()` inside the component body (so it re-renders on theme change), never from the static `colors` export — `StyleSheet.create()` at module scope can't be reactive, so theme-dependent values are applied via inline `style={[...]}` overrides, not baked into the stylesheet. `themeStore` only persists the user's choice (`system`/`light`/`dark`); `useThemeColors()` resolves `system` against the device's live scheme on every render.

## Auth Flow

1. Mobile number entered → OTP sent.
2. OTP verified → account created/logged in.
3. JWT access + refresh tokens issued.
4. User → dashboard immediately. Worker/Business → profile completion → `pending_verification` until admin approves.

## Authorization

Role-based: `user`, `worker`, `business_owner`, `business_staff`, `admin` (+ future admin sub-roles). Every protected endpoint checks authentication (valid JWT) and authorization (role/permission) before executing business logic.

## Search Architecture

Area-based for MVP: users select village/town, workers/businesses define service areas. Search service is isolated behind an interface so GPS-based radius search can be swapped in later without touching booking/order business logic.

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

PostgreSQL, normalized. Core entities: users, workers, businesses, business_staff, worker_profiles, business_profiles, bookings, orders, order_items, notifications, reviews, ratings, verification_requests, audit_logs. Foreign keys enforce relationships; index mobile_number, profession, business_category, service_area (and other frequently-filtered columns). Full DDL lives in `docs/database.md` / `database/migrations/`.

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
