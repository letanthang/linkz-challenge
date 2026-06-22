# Design Proposals — Public Seat Reservation Platform

## Proposal A — Next.js Full-Stack Modular Monolith with Clean Architecture ✅ Recommended

### Summary
A single Next.js application serves both the React UI and the backend via **API Route Handlers** (`app/api/...`). Business logic is organized into domain modules (`auth`, `seat`, `reservation`, `payment`), each with strict Clean Architecture layering: `handler → usecase → repository`. A separate lightweight Node.js worker runs the cleanup cron job alongside the Next.js dev server.

### Components

```
linkz/
├── app/                         # Next.js App Router (UI pages)
│   ├── (auth)/login/
│   ├── seats/
│   └── reservations/[id]/
├── app/api/                     # API Route Handlers (HTTP layer)
│   ├── auth/
│   ├── seats/
│   ├── reservations/
│   └── payments/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── entity/
│   │   │   ├── usecase/
│   │   │   └── repository/
│   │   ├── seat/
│   │   │   ├── entity/
│   │   │   ├── usecase/        # triggers lazy TTL expiry before returning seats
│   │   │   └── repository/
│   │   ├── reservation/
│   │   │   ├── entity/
│   │   │   ├── usecase/        # expiry logic called by seat usecase
│   │   │   └── repository/
│   │   └── payment/
│   │       ├── entity/
│   │       ├── usecase/        # fail-first + idempotency logic
│   │       └── repository/
│   ├── infrastructure/
│   │   ├── persistence/        # Prisma implementations of repositories
│   │   └── container.ts        # DI wiring
│   └── domain/
│       └── repository/         # Base repo interface / tx manager
└── prisma/
    └── schema.prisma
```

### Key decisions

| Concern | Approach |
|---|---|
| Race condition | `SELECT FOR UPDATE` inside a Prisma `$transaction` when reserving a seat |
| Cleanup job | Lazy expiry on every `GET /seats` — no background worker; expired reservations are detected and cleaned up in the same DB transaction before seat data is returned |
| Auth | JWT signed with a secret, stored in `HttpOnly` cookie, 90-day expiry |
| Mock payment | `PaymentRepository` tracks `attempt_count` per reservation; first attempt always returns FAILED, subsequent returns SUCCESS |
| Idempotency | Each payment attempt is assigned a server-generated `idempotency_key`; re-submitting the same key returns the cached result without re-running logic |
| DI | Manual DI in `container.ts` — no framework overhead needed at this scale |

### Trade-offs

**Pros:**
- Matches CLAUDE.md architecture decisions exactly (Clean Arch, Modular Monolith, DI, SOLID).
- API routes and UI in one repo — zero network overhead for intra-service calls, simpler local setup.
- Clean module boundaries make it easy to extract a service later if needed.
- Testable: each layer (usecase, repository) can be tested independently via interface mocks.

**Cons:**
- Expiry is lazy (checked on seat fetch only) — expired reservations won't be cleaned up if no user is active. Acceptable for local/demo; in production a background job would be needed.
- Manual DI wiring in `container.ts` grows verbose at large scale; a DI container library (InversifyJS, TSyringe) would help then.

**Stops being a good fit when:** Team grows past ~5 engineers sharing the same module, or the app needs independent deployability per domain.

---

## Proposal B — Next.js with Server Actions (No Explicit API Layer)

### Summary
Use Next.js **Server Actions** (`"use server"`) directly in React components or page files to handle mutations. No separate `app/api/` layer. Business logic still lives in `src/modules/` with the same Clean Architecture layering, but the transport layer is implicit (Next.js serializes the call).

### Components
Same module structure as Proposal A, but `app/api/` is removed. Mutations call server action functions directly from React components.

### Trade-offs

**Pros:**
- Less boilerplate — no need to write fetch/API client code.
- More idiomatic for Next.js 14+ App Router.

**Cons:**
- Server Actions are tightly coupled to React component trees, making them harder to test independently.
- Less portable — switching away from Next.js means rewriting the transport layer entirely.
- Harder to document with OpenAPI or expose to a mobile client later.
- Race condition handling with `SELECT FOR UPDATE` is harder to reason about when the entry point is a React action vs an explicit HTTP handler.
- **Not recommended for this challenge** — an interviewer reviewing a code challenge expects to see explicit HTTP API design, and Server Actions obscure that.

**Stops being a good fit immediately** for this use case: the explicit API layer in Proposal A better demonstrates backend design thinking.

---

## Proposal C — Next.js Frontend + Separate Express API Server

### Summary
Split the application into two processes: a Next.js app for UI only, and a standalone Express (or Fastify) server for the API. Both run locally.

### Trade-offs

**Pros:**
- Cleaner separation between UI concerns and API concerns.
- Express/Fastify are more familiar to backend engineers; middleware is explicit.

**Cons:**
- Two processes, two configs, CORS setup, more boilerplate — unjustified overhead for a 3-seat local app.
- Next.js API routes already provide a competent HTTP layer with no extra process.
- Overkill for a code challenge; adds complexity without demonstrating proportionally more skill.

**Stops being a good fit** before it starts — wrong tool for this scope.

---

## Recommendation

**Proposal A.** It matches the stated tech stack, demonstrates Clean Architecture and DI clearly, handles the race condition correctly, and keeps local setup to a single `npm run dev` command. The explicit API route layer makes the backend design visible and reviewable.

---

## Revision History

| Rev | Date | Change |
|---|---|---|
| 1.0 | 2026-06-22 | Initial proposals |
