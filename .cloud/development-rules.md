# Development Rules

## Code Standards

- TypeScript everywhere (backend and mobile), strict mode on.
- Follow SOLID and DRY where it genuinely simplifies the code — don't force abstraction for a single use site.
- Small, focused functions and modules. Meaningful names over comments.
- Comment only the non-obvious "why" (hidden constraint, workaround, subtle invariant) — never restate what the code already says.
- No duplicate logic — extract a shared service/util instead.
- Consistent formatting (Prettier + ESLint, enforced in CI).

## Backend Module Convention

Every module: `routes.ts`, `controller.ts`, `service.ts`, `repository.ts`, `validation.ts`, `dto.ts`, `interfaces.ts`, `tests/`. Controllers stay thin (parse request → call service → shape response). Business logic lives in services. Data access lives in repositories only — no raw queries in controllers or services.

## Frontend Convention

Screens contain layout/composition only; business logic and data fetching live in `hooks/` and `services/`. Shared UI goes in `components/`. No inline business logic in JSX.

## Error Handling

- Every error handled gracefully with a meaningful, non-sensitive message to the client.
- Unexpected errors logged server-side with enough context to debug.
- Consistent error shape across all APIs (see [[api-guidelines.md]]).

## Logging

Log: authentication events, API errors, booking/order state transitions, verification attempts, admin actions. Audit logs (admin actions) are append-only and never editable.

## Security

- Validate all input at the API boundary (never trust client data).
- Hash/secure credentials and PINs appropriately; never log PINs or tokens.
- JWT-protected APIs; HTTPS in production; rate-limit auth endpoints.
- Admin endpoints additionally require role/permission checks server-side, not just UI-hidden.

## Git Workflow

```
main
  ↑ (PR + review, after passing tests)
develop
  ↑ (PR + review)
feature/<module>-<short-description>
```

- Branch per feature: `feature/auth-otp-login`, `feature/business-shopping-list`, etc.
- Commit messages: imperative, scoped, e.g. `feat(auth): add OTP verification endpoint`, `fix(booking): correct PIN retry limit`.
- PRs required for any non-trivial change; code review before merge to `develop`; `develop` → `main` only after tests pass.
- Update docs and changelog as part of the same PR that implements the feature — not a follow-up.

## Definition of Done (per feature)

A feature is not complete until:

1. It's implemented and integrated (not isolated/standalone code).
2. Unit + integration + API tests pass.
3. Regression tests across existing features still pass.
4. Related docs (`docs/*.md`, `.cloud/project-context.md`) are updated.
5. No known security gaps for the feature's scope.
