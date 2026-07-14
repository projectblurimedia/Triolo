# Coding Standards

See [[.cloud/development-rules.md]] for the authoritative rules this project follows. Summary:

- TypeScript strict mode, backend and mobile.
- Feature-based modules; each backend module: routes/controller/service/repository/validation/dto/interfaces/tests.
- Controllers thin; business logic in services; data access only in repositories.
- No duplicate logic — extract shared services/utils.
- Comment only non-obvious "why"; never restate what code already shows.
- ESLint + Prettier enforced; consistent formatting across the repo.
- Errors handled gracefully everywhere; consistent response envelope (see `docs/api.md`).
