# Local Services Marketplace (MVP — Telugu States)

A local-services marketplace connecting **Users**, **Workers**, and **Businesses**. MVP launches in the Telugu-speaking states of India, with plans to expand nationwide. Built as a modular monolith designed to evolve into microservices without a major rewrite.

## Project Structure

```
.cloud/       AI/engineering instructions & living project memory (auto-loaded via CLAUDE.md)
docs/         Product & engineering documentation (vision, SRS, architecture, API, etc.)
design/       Wireframes, UI, design system
backend/      Node.js + Express + TypeScript API (modular monolith)
mobile/       React Native + TypeScript app
shared/       Types/contracts shared between backend and mobile
database/     Migrations and seeds
scripts/      Dev/ops scripts
docker/       Dockerfiles and compose configs
tests/        Cross-cutting/e2e tests (module-level tests live inside each backend module)
configs/      Shared configuration
```

## Tech Stack

- **Mobile**: React Native, TypeScript
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL
- **Auth**: Mobile OTP + JWT (access/refresh)
- **Notifications**: Firebase Cloud Messaging
- **Localization**: English + Telugu from launch

## Getting Started

See `backend/README.md` and `mobile/README.md` once scaffolded, and `docs/environment.md` for required configuration.

## Documentation

Start with `docs/vision.md` and `docs/product-specification.md` for what the app does, `docs/architecture.md`-equivalent (`.cloud/architecture.md`) for how it's built, and `docs/api.md` / `docs/database.md` as they grow with implementation.

## Contributing

See `CONTRIBUTING.md`.
