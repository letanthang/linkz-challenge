# Chosen Architecture — Next.js Full-Stack Modular Monolith with Clean Architecture

## Decision

**Proposal A** from `design-proposals.md` is selected.

## Why this and not the alternatives

| Alternative | Why rejected |
|---|---|
| Proposal B (Server Actions) | Obscures the explicit HTTP API layer; harder to test usecases independently; less readable for an interviewer evaluating backend design |
| Proposal C (Express API separate) | Unjustified overhead for a 3-seat local challenge; two processes, CORS, duplicate config |

Proposal A is the right fit because:
- A single Next.js process handles both UI (App Router pages) and backend (API Route Handlers) — minimal local setup (`npm run dev` only).
- Clean Architecture module boundaries (`entity → repository interface → usecase → handler`) make business logic testable in isolation from the framework.
- Manual DI via `container.ts` keeps wiring explicit and readable without library overhead.
- `SELECT FOR UPDATE` inside a Prisma transaction is the correct, simple race-condition guard for a single-node MySQL deployment.
- Lazy TTL expiry on `GET /seats` eliminates the need for a background worker while keeping the `expires_at` field as a first-class data contract.

## Finalized Architecture Summary

### Directory structure

```
linkz/
├── app/                          # Next.js App Router — UI pages
│   ├── (auth)/login/
│   ├── seats/
│   └── reservations/[id]/
├── app/api/                      # API Route Handlers — HTTP transport layer
│   ├── auth/login/route.ts
│   ├── auth/logout/route.ts
│   ├── seats/route.ts
│   ├── reservations/route.ts
│   └── payments/[reservationId]/route.ts
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── entity/user.ts
│   │   │   ├── usecase/loginUsecase.ts
│   │   │   └── repository/userRepository.ts       # interface
│   │   ├── seat/
│   │   │   ├── entity/seat.ts
│   │   │   ├── usecase/listSeatsUsecase.ts         # triggers lazy expiry first
│   │   │   └── repository/seatRepository.ts        # interface
│   │   ├── reservation/
│   │   │   ├── entity/reservation.ts
│   │   │   ├── usecase/createReservationUsecase.ts
│   │   │   ├── usecase/expireReservationsUsecase.ts
│   │   │   └── repository/reservationRepository.ts # interface
│   │   └── payment/
│   │       ├── entity/payment.ts
│   │       ├── usecase/processPaymentUsecase.ts    # fail-first + idempotency
│   │       └── repository/paymentRepository.ts     # interface
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   ├── prismaUserRepository.ts
│   │   │   ├── prismaSeatRepository.ts
│   │   │   ├── prismaReservationRepository.ts
│   │   │   └── prismaPaymentRepository.ts
│   │   └── container.ts                            # manual DI wiring
│   └── domain/
│       └── repository/baseRepository.ts            # tx manager interface
└── prisma/
    ├── schema.prisma
    └── seed.ts                                      # seats + test users
```

### Request flow (example: list seats)

```
GET /api/seats
  → handler reads JWT from HttpOnly cookie, verifies auth
  → container.listSeatsUsecase()
      → expireReservationsUsecase.run()            ← lazy TTL cleanup (in same tx)
      → seatRepository.findAll()
  → returns seat list with current statuses
```

### Request flow (example: reserve a seat)

```
POST /api/reservations
  → handler verifies auth
  → container.createReservationUsecase(userId, seatId)
      → BEGIN TRANSACTION
      → seatRepository.findByIdForUpdate(seatId)  ← SELECT FOR UPDATE
      → assert seat.status === AVAILABLE
      → create reservation { status: PENDING_PAYMENT, expires_at: now+10min }
      → seat.status = RESERVED
      → COMMIT
  → returns reservation
```

### Request flow (example: pay)

```
POST /api/payments/:reservationId
  → handler verifies auth
  → container.processPaymentUsecase(reservationId, userId)
      → assert reservation.status === PENDING_PAYMENT
      → assert reservation.expires_at > now
      → if reservation.payment_attempt_count === 0 → fail, increment count, return FAILED
      → if reservation.payment_attempt_count >= 1 → succeed, reservation.status = CONFIRMED
  → returns payment result
```

## Key constraints carried forward to data model

- `Reservation` must have: `status`, `expires_at`, `payment_attempt_count`
- `Seat` must have: `status` (denormalized for fast reads, kept in sync within transactions)
- `Payment` record created per attempt for audit trail (even failed ones)
- JWT payload: `{ sub: userId, exp: now+90days }`; stored in `HttpOnly; SameSite=Strict` cookie
