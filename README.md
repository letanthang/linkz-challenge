# Linkz — Public Seat Reservation

A small public seat reservation platform built as a code challenge, using a TypeScript/Next.js full-stack modular monolith with Clean Architecture.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, API Routes) |
| Language | TypeScript |
| Database | MySQL |
| ORM | Prisma |
| Auth | JWT (HttpOnly cookie, 90-day expiry) |
| Styling | Tailwind CSS |
| Testing | Jest + ts-jest |

## Getting Started

### Prerequisites
- Node.js 20+
- MySQL running locally with database `linkz` and a user with read/write access
- Copy `.env.example` to `.env` and fill in your credentials

### Setup & Run

```bash
npm install
make run
```

`make run` runs: `prisma db push` → `prisma db seed` → `npm run dev`

Open [http://localhost:3000](http://localhost:3000) and log in with a seeded account:

| Email | Password |
|---|---|
| alice@test.com | password123 |
| bob@test.com | password123 |
| carol@test.com | password123 |

### Run Tests

```bash
make test
# or
npm test
```

## Architecture

Clean Architecture modular monolith. Dependency direction: `Handler → Usecase → Repository`.

```
src/
├── modules/
│   ├── auth/        # Login, JWT issuance
│   ├── seat/        # Seat listing with lazy TTL expiry
│   ├── reservation/ # Create reservation (SELECT FOR UPDATE), expire TTL
│   └── payment/     # Mock payment with fail-first + idempotency
├── infrastructure/
│   ├── persistence/ # Prisma repository implementations
│   ├── container.ts # Manual DI wiring
│   └── txStorage.ts # AsyncLocalStorage for transparent transaction propagation
└── lib/
    └── errors.ts    # Typed error hierarchy (AppError, NotFoundError, …)
```

## Reservation Flow

```
Select seat → POST /api/reservations → PENDING_PAYMENT (10-min TTL)
                                           ↓
                                  POST /api/payments/:id
                                       attempt 1 → FAILED
                                       attempt 2 → CONFIRMED
                                       same key  → cached (idempotency)
                                           ↓
                                  TTL exceeded → EXPIRED (lazy, on GET /seats)
```

## Design Decisions & Trade-offs

### SELECT FOR UPDATE for race conditions
Works correctly on a single DB node. Does not scale to read replicas or distributed DBs. At higher scale, optimistic locking (version field) or a distributed lock (Redis SETNX) would be preferred.

### Lazy TTL expiry (no background worker)
Expiry runs on every `GET /seats` — no separate process needed. Downside: reservations only expire when a user fetches seats. In production a background job would guarantee timely cleanup regardless of traffic.

### JWT in HttpOnly cookie, 90-day expiry
Protects against XSS. No refresh token for simplicity — in production use short-lived access tokens (15 min) + refresh tokens with server-side revocation.

### Mock payment — fail-first, retry-success
Intentionally artificial to demonstrate retry logic, idempotency, and edge-case awareness. First attempt always fails; retry always succeeds. Idempotency key is server-generated per attempt; replaying the same key returns the cached result without re-processing.

### Login-only (no self-registration)
Seeded users simplify the demo. In production: self-registration, email verification, and password reset flows would be added behind the same `UserRepository` interface.

### Confirmed reservation cancellation
Not implemented. Future work: release seat to `AVAILABLE`, handle refund logic, add `CANCELLED` terminal state to the reservation state machine.

## Scenario

1. **Log in** — use any seeded account (e.g. `alice@test.com / password123`)
2. **Browse seats** — the seat grid shows real-time availability; expired reservations are cleaned up automatically on each page load
3. **Reserve a seat** — click an available seat; it transitions to `RESERVED` and you land on the payment page with a 10-minute countdown
4. **First payment attempt** — always fails (by design); status remains `PENDING_PAYMENT`
5. **Retry payment** — succeeds; reservation moves to `CONFIRMED`
6. **Idempotency** — clicking "Pay" again with the same server-generated key returns the cached result without re-processing
7. **Expiry** — if the 10-minute TTL elapses before payment, the reservation becomes `EXPIRED` and the seat returns to `AVAILABLE` on the next seat fetch