# Design Requirements — Public Seat Reservation Platform

## 1. Overview

A small public seat reservation platform built as a code challenge/assessment. The approach should be simple but well-reasoned, with trade-offs documented explicitly.

---

## 2. Functional Requirements

### 2.1 Authentication
- Login-only flow using pre-seeded test users (email + password).
- Session represented by a JWT with a **90-day expiry**.
- No refresh token — for simplicity in this challenge scope.

### 2.2 Seats
- **3 fixed seats** seeded in the database with names: **Seat A, Seat B, Seat C**.
- Each seat has a status: `AVAILABLE` | `RESERVED`.
- All authenticated users can view the seat availability in real time.

### 2.3 Reservation Flow
1. User selects an available seat.
2. System creates a reservation with status `PENDING_PAYMENT`.
3. User proceeds to payment (mock).
4. **Payment attempt 1 always fails** (to demonstrate failure handling).
5. User retries payment — **retry succeeds**.
6. Reservation status transitions to `CONFIRMED`; seat status remains `RESERVED`.

**Full status state machine:**
```
PENDING_PAYMENT → (payment fail) → PENDING_PAYMENT (retry eligible)
PENDING_PAYMENT → (payment success) → CONFIRMED
PENDING_PAYMENT → (TTL expired) → EXPIRED
```

### 2.4 Payment TTL
- User has **10 minutes** to complete payment after a reservation is created.
- Expiry is enforced **lazily**: on every `GET /seats` request, the server checks all `PENDING_PAYMENT` reservations whose `expires_at` has passed and transitions them to `EXPIRED`, releasing the seat to `AVAILABLE` in the same transaction before returning seat data.
- No background worker process is required.
- On expiry: reservation status → `EXPIRED`; seat status → `AVAILABLE` immediately.

### 2.5 Mock Payment
- Payment is mocked (no real payment gateway).
- First attempt for any reservation **always fails**.
- Retry **always succeeds**.
- This demonstrates: retry logic, idempotency, and edge-case awareness.

---

## 3. Non-Functional Requirements

| Concern | Decision |
|---|---|
| Race conditions | `SELECT FOR UPDATE` to prevent two users reserving the same seat simultaneously |
| Deployment | Local only |
| Scale | Single-node, no distributed concerns for this challenge |

---

## 4. Tech Stack (from project CLAUDE.md)

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Framework | Next.js (frontend + backend via API routes) |
| UI | shadcn/ui |
| Database | MySQL |
| ORM | Prisma |
| Auth | JWT (90-day, no refresh), stored in `HttpOnly` cookie |

---

## 5. Clarifications (from design interview)

| # | Question | Answer |
|---|---|---|
| 1 | User registration | Seed test users; login-only flow |
| 2 | Mock payment behavior | Fail on first attempt, succeed on retry |
| 3 | TTL expiry outcome | Status → `EXPIRED`, seat → `AVAILABLE` immediately |
| 4 | Confirmed reservation cancellation | Not in scope for this version |
| 5 | Seat definition | 3 fixed seats seeded in DB (Seat A, B, C) |
| 6 | Deployment target | Local only |

---

## 6. Assumptions

- **Assumption:** A user can only hold one `PENDING_PAYMENT` reservation at a time. If they attempt to reserve a second seat while one is pending, the system rejects it. *(Not explicitly stated — inferred from UX simplicity.)*
- **Assumption:** Seat availability is shown to all users on page load; no real-time WebSocket push is required for this challenge. A page refresh is acceptable.
- **Assumption:** No role-based access control (RBAC). All seeded users have equal permissions.
- **Assumption:** No email/notification system required.

---

## 7. Trade-offs & Notes

### 7.1 Login-only (no self-registration)
**Trade-off:** Seeded users are simpler to implement and demo, but in production any platform needs self-registration, email verification, and password reset flows. The auth module should be designed so these can be added without restructuring (e.g., a `UserRepository` interface that a registration use case can extend).

### 7.2 90-day JWT, no refresh token
**Trade-off:** Simpler implementation — one token, no rotation logic. In production this is a security risk: a stolen token is valid for 90 days with no revocation path. The correct production pattern is short-lived access tokens (15 min) + long-lived refresh tokens stored in HttpOnly cookies, with server-side revocation. For this challenge, the long expiry is acceptable and noted.

### 7.3 Mock payment — fail-first, retry-success
**Trade-off:** This is intentionally artificial to demonstrate retry/idempotency awareness. In production, payment state would come from a webhook (e.g., Stripe) and the idempotency key would be generated client-side or server-side and passed to the gateway. Here, idempotency is simulated by tracking attempt count per reservation.

### 7.4 Confirmed reservation cancellation (future feature)
**Not implemented in this version.** When added, it must: (a) release the seat back to `AVAILABLE`, (b) handle partial refund logic, (c) consider a cancellation window policy. The reservation status machine should include a `CANCELLED` state as a terminal state.

### 7.5 Fixed seats (no admin flow)
**Trade-off:** Seeding 3 fixed seats removes the need for an admin module entirely. In production, seats would be managed by an admin (add/remove/rename) and would likely belong to an `Event` or `Venue` entity. The `Seat` entity is designed to allow this extension (event_id FK can be added later without breaking the reservation logic).

### 7.6 SELECT FOR UPDATE for race conditions
**Trade-off:** Works correctly on a single DB node and is simple to reason about. Does not scale to read replicas or distributed DBs. At higher scale, an optimistic locking strategy (version field + retry on conflict) or a distributed lock (Redis SETNX) would be preferred. For this challenge, `SELECT FOR UPDATE` inside a Prisma transaction is the right call.

### 7.7 Lazy TTL expiry (no background worker)
**Trade-off:** Running expiry logic on every `GET /seats` request eliminates the need for a separate worker process, which simplifies local setup to a single `npm run dev` command. The downside is that expiry only triggers when a user fetches seats — if no users are active, expired reservations linger in the DB (but seats still appear reserved to no one). In production, a background job or a DB-level event scheduler would guarantee timely cleanup regardless of traffic. For this challenge, lazy expiry is acceptable and the `expires_at` field on reservations makes the intent clear.

### 7.8 JWT stored in HttpOnly cookie
**Trade-off:** Storing the JWT in an `HttpOnly` cookie protects it from XSS attacks (JavaScript cannot read it). The downside is that it requires CSRF protection for state-mutating requests. For this local challenge, same-origin requests from Next.js API routes mean CSRF is not a practical risk — but in production, a `SameSite=Strict` or CSRF token would be required. `localStorage` is simpler to implement but is vulnerable to XSS by design and is not used here.
