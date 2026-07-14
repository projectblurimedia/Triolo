# Vision

## Project Vision

A local services marketplace for India, launching first as an MVP in the Telugu-speaking states. The platform connects three participants:

- **Users** — customers who want to hire workers or buy from nearby shops.
- **Workers** — verified local service professionals (electricians, plumbers, tailors, carpenters, painters, etc.).
- **Businesses** — verified local shops (grocery, medical, hardware, bakery, etc.).

The goal: help users find nearby workers and businesses quickly, reducing search time for reliable services while creating more work/business opportunities for workers and shops.

## Design Principles

- Simple, lightweight, low-cost, easy to use for the MVP.
- Modular Monolith architecture that can evolve into microservices without major rewrites.
- No live GPS in the MVP — village/town based search, upgradeable later.
- No SMS OTP for service completion — free backend-generated in-app PINs instead.
- Telugu + English language support from launch (settings-level toggle).

## Target Users

| Type | Verification Required | Examples |
|---|---|---|
| User | No | Any customer |
| Worker | Yes (admin-approved) | Electrician, Plumber, Tailor, Carpenter, Painter, House Cleaner, Construction Worker |
| Business | Yes (admin-approved) | Grocery, Medical, Hardware, Bakery, Vegetable Shop, Electrical Shop |

## Business Model

MVP focuses on adoption and reliability over monetization. Future revenue avenues (post-MVP, not built now): subscriptions, featured/sponsored listings, advertisements, commission on completed transactions. See `docs/roadmap.md` for sequencing.

## MVP Goal → Expansion Path

1. Launch MVP in Telugu-speaking states (Andhra Pradesh, Telangana).
2. Validate worker/business supply and booking/order reliability.
3. Expand state by state across India, adding languages/regions incrementally.
4. Scale architecture (modular monolith → targeted microservices) only as load demands it.

Full functional detail: `docs/product-specification.md`.
