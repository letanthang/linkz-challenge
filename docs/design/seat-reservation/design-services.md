# Service Decomposition — Public Seat Reservation Platform

This is a **modular monolith** — "services" here are internal module boundaries, not separate deployable processes. All communication is synchronous, in-process function calls.

---

## Module Map

```
┌─────────────────────────────────────────────────────┐
│                  HTTP Layer (app/api/)               │
│  /auth   /seats   /reservations   /payments          │
└────┬──────────┬──────────┬──────────┬───────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
┌─────────┐ ┌──────┐ ┌───────────┐ ┌─────────┐
│  auth   │ │ seat │ │reservation│ │ payment │
│ module  │ │module│ │  module   │ │ module  │
└─────────┘ └──┬───┘ └─────┬─────┘ └────┬────┘
               │            │             │
               └─────┬──────┘             │
                     │                    │
               ┌─────▼────────────────────▼──┐
               │   infrastructure/persistence │
               │   (Prisma implementations)   │
               └─────────────┬───────────────┘
                             │
                      ┌──────▼──────┐
                      │    MySQL    │
                      └─────────────┘
```

---

## Module Definitions

### 1. `auth`

| Field | Detail |
|---|---|
| **Purpose** | Authenticate users; issue and verify JWTs |
| **Owned data** | `User` (id, email, password_hash) |
| **Exposes** | `LoginUsecase`, `verifyToken(cookie)` middleware helper |
| **Depends on** | `UserRepository` (interface), `domain/repository` tx manager |
| **Communication** | Sync only. Called by `/api/auth/login` and `/api/auth/logout` route handlers. `verifyToken` is called by every other route handler before delegating to its usecase. |
| **Does NOT own** | Sessions, reservations, payments |

**Responsibilities:**
- Validate email + password against seeded `User` records (bcrypt compare).
- Sign a JWT `{ sub: userId, exp: now+90d }` and write it to an `HttpOnly; SameSite=Strict` cookie.
- `verifyToken`: parse the cookie, verify JWT signature, return `userId` or throw `401`.
- Logout: clear the cookie (JWT is stateless — no server-side revocation at this scope).

---

### 2. `seat`

| Field | Detail |
|---|---|
| **Purpose** | Expose seat availability; trigger lazy TTL expiry before returning data |
| **Owned data** | `Seat` (id, name, status) |
| **Exposes** | `ListSeatsUsecase` |
| **Depends on** | `SeatRepository` (interface), `ExpireReservationsUsecase` (from `reservation` module) |
| **Communication** | Sync. `ListSeatsUsecase` calls `ExpireReservationsUsecase.run()` first, then fetches all seats. Both run inside the same Prisma transaction to ensure consistency. |
| **Does NOT own** | Reservation state, payment state |

**Responsibilities:**
- Before returning seats, delegate to `reservation` module to expire any overdue `PENDING_PAYMENT` reservations (which frees seats back to `AVAILABLE`).
- Return the current status of all 3 seats.

**Dependency note:** `seat` depends on `reservation` (for expiry), but `reservation` also depends on `seat` (to update seat status when reserving/expiring). This is a **bidirectional dependency at the usecase level** — resolved by passing `SeatRepository` into `ExpireReservationsUsecase` rather than importing the `seat` module directly, keeping module coupling at the interface level only.

---

### 3. `reservation`

| Field | Detail |
|---|---|
| **Purpose** | Create reservations with race-condition safety; expire overdue reservations |
| **Owned data** | `Reservation` (id, userId, seatId, status, expires_at, payment_attempt_count) |
| **Exposes** | `CreateReservationUsecase`, `ExpireReservationsUsecase` |
| **Depends on** | `ReservationRepository` (interface), `SeatRepository` (interface), `domain/repository` tx manager |
| **Communication** | Sync. Called by `/api/reservations` (POST) and internally by `seat` module on every `GET /seats`. |
| **Does NOT own** | Payment records, seat entity definition |

**Responsibilities:**

`CreateReservationUsecase`:
- Assert the user has no existing `PENDING_PAYMENT` reservation.
- Open a transaction: `SELECT seat FOR UPDATE` → assert `AVAILABLE` → create `Reservation` with `status=PENDING_PAYMENT`, `expires_at=now+10min`, `payment_attempt_count=0` → set `seat.status=RESERVED` → commit.
- Return the new reservation.

`ExpireReservationsUsecase`:
- Find all `PENDING_PAYMENT` reservations where `expires_at < now`.
- For each: set `reservation.status=EXPIRED` and `seat.status=AVAILABLE` in a single transaction.
- Called by `ListSeatsUsecase` on every seat fetch.

---

### 4. `payment`

| Field | Detail |
|---|---|
| **Purpose** | Process mock payments with fail-first logic and idempotency |
| **Owned data** | `Payment` (id, reservationId, idempotencyKey, status, attempt_number, created_at) |
| **Exposes** | `ProcessPaymentUsecase` |
| **Depends on** | `PaymentRepository` (interface), `ReservationRepository` (interface) |
| **Communication** | Sync. Called by `/api/payments/:reservationId` (POST). |
| **Does NOT own** | Reservation status transitions (delegates back to `ReservationRepository`) |

**Responsibilities:**

`ProcessPaymentUsecase`:
1. Load reservation; assert `status === PENDING_PAYMENT` and `expires_at > now`.
2. Check for an existing `Payment` record with the same `idempotencyKey` — if found, return its cached result (idempotency guard).
3. Increment `reservation.payment_attempt_count`.
4. **If `attempt_count === 1` (first attempt):** create `Payment { status: FAILED }`, return failure.
5. **If `attempt_count > 1` (retry):** create `Payment { status: SUCCESS }`, set `reservation.status = CONFIRMED`, return success.
6. The `idempotencyKey` is generated server-side per POST request (UUID); the client receives it in the response and must send it back on retry.

---

## Cross-Cutting Concerns

### `domain/repository` — Transaction Manager

Defines the `TransactionManager` interface used by usecases that need to coordinate writes across repositories:

```typescript
interface TransactionManager {
  run<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
```

All Prisma repository implementations accept an optional `tx` parameter so they can participate in the same `prisma.$transaction` call.

### `infrastructure/container.ts` — DI Wiring

Instantiates all repositories and usecases and wires them together. API route handlers import from `container` only — they never `new` a usecase directly.

```typescript
// example shape
export const container = {
  loginUsecase: new LoginUsecase(new PrismaUserRepository()),
  listSeatsUsecase: new ListSeatsUsecase(
    new PrismaSeatRepository(),
    new ExpireReservationsUsecase(new PrismaReservationRepository(), new PrismaSeatRepository(), txManager),
  ),
  createReservationUsecase: new CreateReservationUsecase(
    new PrismaReservationRepository(),
    new PrismaSeatRepository(),
    txManager,
  ),
  processPaymentUsecase: new ProcessPaymentUsecase(
    new PrismaPaymentRepository(),
    new PrismaReservationRepository(),
  ),
};
```

---

## Dependency Summary

| Module | Depends on (interfaces only) |
|---|---|
| `auth` | `UserRepository` |
| `seat` | `SeatRepository`, `ExpireReservationsUsecase` |
| `reservation` | `ReservationRepository`, `SeatRepository`, `TransactionManager` |
| `payment` | `PaymentRepository`, `ReservationRepository` |

No module imports another module's concrete classes — only its interfaces or exported usecases. This keeps the dependency direction clean and each module independently testable.

---

## Communication Style

All communication is **synchronous, in-process**. There is no message queue, event bus, or async worker in this scope.

| Flow | Style |
|---|---|
| Route handler → usecase | Sync function call |
| Usecase → repository | Sync function call |
| seat usecase → reservation usecase | Sync function call (lazy expiry) |
| payment usecase → reservation repository | Sync function call (update status) |
