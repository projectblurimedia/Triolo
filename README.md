# Local Services Marketplace (MVP — Telugu States)

A local-services marketplace connecting **Users**, **Workers**, and **Businesses**. MVP launches in the Telugu-speaking states of India, with plans to expand nationwide. Built as a modular monolith designed to evolve into microservices without a major rewrite.

## Project Structure

```
.cloud/              AI/engineering instructions & living project memory (auto-loaded via CLAUDE.md)
docs/                Product & engineering documentation (vision, SRS, architecture, API, etc.)
design/              Wireframes, UI, design system
backend/             Node.js + Express + TypeScript API (modular monolith)
user-app/            React Native + TypeScript app — the consumer-facing "Triolo" app
partner-app/         React Native + TypeScript app — "Triolo Partner", Worker/Business registration & login
registration-web/    React + Vite + TypeScript — public Worker/Shop registration forms only
admin-web/           React + Vite + TypeScript — Admin verification dashboard only
shared/              Types/contracts shared between backend and the apps
database/            Migrations and seeds
scripts/             Dev/ops scripts
docker/              Dockerfiles and compose configs
tests/               Cross-cutting/e2e tests (module-level tests live inside each backend module)
configs/             Shared configuration
```

## Tech Stack

- **Mobile**: React Native, TypeScript
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL
- **Auth**: Mobile OTP + JWT (access/refresh)
- **Notifications**: Firebase Cloud Messaging
- **Localization**: English + Telugu from launch

## Getting Started

See `backend/README.md`, `user-app/README.md`, `partner-app/README.md`, `registration-web/README.md`, and `admin-web/README.md`, and `docs/environment.md` for required configuration.

## Documentation

Start with `docs/vision.md` and `docs/product-specification.md` for what the app does, `docs/architecture.md`-equivalent (`.cloud/architecture.md`) for how it's built, and `docs/api.md` / `docs/database.md` as they grow with implementation.

## Contributing

See `CONTRIBUTING.md`.
