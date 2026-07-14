# Localization

Localization is a core architectural requirement, not an optional layer added after features are built. No feature is complete without English + Telugu support (see Definition of Done in `.cloud/development-rules.md`).

## Supported Languages

- MVP: English (`en`), Telugu (`te`).
- Future (no business-logic changes required to add): Hindi, Tamil, Kannada, Malayalam, Marathi, etc.

## Design Principle

Translation is not word-for-word. Telugu copy should read the way Telugu speakers actually talk — plain, everyday register, not formal/literary Telugu. Every new Telugu string should be sanity-checked against that bar (ideally by a native speaker) before shipping, not just machine-translated and left as-is.

## Where Language Is Stored

Two places, kept in sync:

1. **Account record** (`accounts.preferred_language`, backend) — authoritative once a user is logged in; carries across devices.
2. **Device storage** (mobile `settingsStore`, persisted via AsyncStorage) — used before login/registration and as the immediate UI source of truth.

Flow:
- **First app launch** (no account yet): device locale is used as the initial guess (`expo-localization`), but the user is shown an explicit language picker and must confirm before proceeding — never silently assumed.
- **During registration**: the currently active app language is sent as `preferredLanguage` with the registration request, so the account is created with it already set.
- **After login**: the account's `preferred_language` (from the backend) overwrites local device state — so logging into a new device applies the language tied to that account, not the device's own locale guess.
- **In Settings, after login**: changing the language updates local state immediately (UI reflects it with no reload/re-login) *and* calls the backend to persist it to the account (`PATCH /auth/me/language`).

## Backend Rules

- APIs are language-independent. The backend never decides what language to respond in for API payloads — it stores and returns UTF-8 text as given.
- The one exception is **push notification content** and **admin announcements**, which are explicitly per-recipient-language by design (see below) — this is a delivery-content concern, not an API-response-language concern.
- Validation/error messages returned by the API (`message` field) are for logs/debugging and API consumers in general — **the mobile app must not display `error.message` directly to users**. It must map `error.code` to a localized string client-side. See `mobile/src/localization/errorMessages.ts`.
- All text columns are UTF-8 (Postgres default `UTF8` encoding) and must never be constrained to ASCII/English-only patterns. Regex validation (e.g. mobile number format) may restrict character sets where the underlying data is genuinely numeric/structured, but free-text fields (names, addresses, shopping list items, reviews, business names, worker descriptions) accept any Unicode input unmodified.

## Category / Reference Data Pattern (for future modules)

Worker professions and business categories are **not** stored as English strings that get translated on display. They're stored as a stable internal code (e.g. `electrician`, `plumber`), and each supported language has a display-label mapping for that code. When Worker Search and Business Search are implemented:

- A `service_categories` (or similar) reference table stores `code` (stable, language-independent) plus a `labels` structure (e.g. `jsonb` keyed by language code, or a `category_translations` table keyed by `(code, language)`).
- Search matches against the **code** internally; the frontend sends/receives codes, and renders the localized label from its own translation resources (or from the label the backend returns for the requesting `Accept-Language`/user's stored preference, if the backend chooses to resolve it — a decision to make when that module is built, not now).
- This lets a user search in Telugu ("ఎలక్ట్రిషియన్") and a business owner see the same request in English ("Electrician") — same underlying category, no logic branching on language.

## Notifications

Push notification bodies are composed server-side (they can't be composed client-side, since the backend triggers them). The notification service resolves the recipient's `accounts.preferred_language` and selects the corresponding template string when composing the payload. Templates live per-event, per-language (e.g. `order.readyForPickup.en`, `order.readyForPickup.te`) — not translated at send time.

## Admin Announcements

An announcement can carry content in one language, the other, or both. Data shape (when Admin module is built): announcement content is a per-language map (similar to notification templates), not a single string. If a user's `preferred_language` has no content for a given announcement, fall back to English rather than showing nothing.

## Mobile / Frontend Rules

- No hardcoded user-visible strings in components. Every string goes through `useTranslation()` / a translation key, resolved from `src/localization/{en,te}.json`.
- Shopping list items, reviews, names, addresses, and other free-text user input are **never** translated automatically — stored and displayed exactly as entered, in whichever script/language the user typed.
- Error messages shown to the user are resolved from `error.code` via a client-side mapping (`errorMessages.ts`), never from the raw API `message` string.
- New screens/features must ship with both `en` and `te` keys added in the same change — an English-only string is treated the same as a bug.

## Adding a New Language Later

1. Add the language code to `SUPPORTED_LANGUAGES` in `mobile/src/localization/i18n.ts`.
2. Add a new resource file (`hi.json`, `ta.json`, etc.) with the same key structure as `en.json`.
3. Add the language option to the language picker UI (`LanguageSwitcher` component).
4. If category/notification/announcement translation tables exist by then, add rows for the new language code — no schema change, no business-logic change.

No backend business logic branches on language at any point — adding a language is purely additive content, confirming the goal stated in the master project instructions.
