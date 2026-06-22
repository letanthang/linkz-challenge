# Architecture Decision Records

---

## ADR-001 — SELECT FOR UPDATE for seat reservation race condition

**Date:** 2026-06-22
**Status:** Accepted

### Context
The platform has only 3 seats and potentially many concurrent users. Without locking, two users could simultaneously read a seat as AVAILABLE and both successfully create a reservation for it.

### Decision
Use `SELECT ... FOR UPDATE` inside a Prisma `$transaction` when creating a reservation. The seat row is locked for the duration of the transaction; any concurrent attempt to lock the same row blocks until the first transaction commits or rolls back.

### Alternatives considered
- **Optimistic locking (version field):** Add a `version` column; update with `WHERE version = :expected`; retry on 0 rows affected. More scalable under read-heavy workloads (no blocking reads), but requires retry logic in the usecase and is harder to reason about under high contention.
- **Redis SETNX distributed lock:** Correct for multi-node deployments. Adds an infrastructure dependency (Redis) that is not justified for a single-node local app.

### Trade-offs
`SELECT FOR UPDATE` serializes concurrent reservation attempts for the same seat, which is exactly the desired behaviour here. It does not scale beyond a single primary DB node. Acceptable for this scope.

---

## ADR-002 — Lazy TTL expiry on GET /seats (no background worker)

**Date:** 2026-06-22
**Status:** Accepted

### Context
Expired `PENDING_PAYMENT` reservations must release their seat back to `AVAILABLE`. The requirement originally called for a cleanup job running every minute.

### Decision
Run expiry logic synchronously at the start of every `GET /seats` request (`ExpireReservationsUsecase` called by `ListSeatsUsecase`). Expired reservations are detected and resolved in the same DB transaction before seat data is returned to the client.

### Alternatives considered
- **Background cron worker (`node-cron`):** Accurate timing (runs every minute regardless of traffic) but requires a second process, complicating local setup and production deployment (Vercel has no persistent process; would need Vercel Cron or an external scheduler).
- **DB-level event scheduler (MySQL Event):** Keeps cleanup in the DB layer; no application process needed. But DB events are hard to version-control, test, and observe. Not idiomatic for this stack.

### Trade-offs
Lazy expiry is simple (single process, single `npm run dev`) and correct for demo purposes. Downside: if no user is active, expired reservations persist in the DB beyond their TTL (seats remain logically reserved to no one until the next `GET /seats`). The `expires_at` field makes the intent auditable. Acceptable for a local code challenge.

---

## ADR-003 — JWT in HttpOnly cookie (no localStorage, no Authorization header)

**Date:** 2026-06-22
**Status:** Accepted

### Context
The app needs to authenticate API requests from a Next.js frontend. Common storage options are `localStorage`, `sessionStorage`, or an `HttpOnly` cookie.

### Decision
Store the JWT in an `HttpOnly; SameSite=Strict` cookie set by the login endpoint. The browser sends it automatically on every same-origin request; API route handlers read it from `req.cookies`.

### Alternatives considered
- **localStorage + Authorization header:** Simpler to implement (no cookie parsing needed). Vulnerable to XSS — any injected script can read and exfiltrate the token. Rejected on security grounds.
- **Server-side session (DB-backed):** Fully revocable; no JWT needed. Adds a `sessions` table and lookup on every request. Overkill for this challenge; JWT is simpler.

### Trade-offs
`HttpOnly` cookies are not readable by JavaScript, making them safe from XSS. `SameSite=Strict` mitigates CSRF without requiring a CSRF token for same-origin Next.js requests. The 90-day expiry means a stolen cookie is valid for a long time — acceptable for a demo, not for production (where short-lived access tokens + refresh tokens would be required).

---

## ADR-004 — Server-side idempotency key for mock payment

**Date:** 2026-06-22
**Status:** Accepted

### Context
The mock payment endpoint must demonstrate idempotency awareness: re-submitting the same payment request (e.g. due to a network timeout) should not create a duplicate charge or increment the attempt counter.

At the same time, a deliberate retry (after a FAILED attempt) must be treated as a new attempt so the fail-first logic can advance to SUCCESS.

### Decision
- On each POST `/api/payments/:reservationId` **without** an `Idempotency-Key` header: server generates a new UUID, creates a new `Payment` record, increments `paymentAttemptCount`, and returns the key in the response.
- On each POST with `Idempotency-Key: <uuid>`: server looks up the existing `Payment` record by that key. If found, returns the cached result immediately without re-processing.

This separates two distinct client intents:
- **Replay** (same key): "I'm not sure my last request landed — give me the result without doing it again."
- **Retry** (no key / new key): "My last attempt failed — please make a new attempt."

### Alternatives considered
- **Client-generated idempotency key:** Standard pattern (Stripe uses this). Client generates a UUID before the first attempt and sends it on every retry. The server deduplicates on key alone. Simpler for the client but requires the client to manage key generation and storage — more complexity in the UI for this challenge.
- **Single payment endpoint with `force: true` flag for retry:** Non-standard, conflates two concerns, not idiomatic.

### Trade-offs
Server-generated key is slightly unusual (most APIs use client-generated keys) but removes key-management responsibility from the UI, keeping the frontend simple. The intent distinction (replay vs retry) is expressed through the presence or absence of the header, which is clear and explicit.

---

## ADR-005 — Denormalized `seat.status` column

**Date:** 2026-06-22
**Status:** Accepted

### Context
Seat availability can be derived by querying whether an active (`PENDING_PAYMENT` or `CONFIRMED`) reservation exists for the seat. A derived query requires a JOIN on every seat list request.

### Decision
Add a `status` column directly to the `seats` table (`AVAILABLE | RESERVED`) and keep it in sync with reservation state within the same DB transaction as every reservation write.

### Alternatives considered
- **Fully normalized (no status column):** `GET /seats` queries `reservations` with a subquery/JOIN to determine availability. No risk of denormalization drift. Slightly more complex query; at 3 seats and low traffic, the performance difference is negligible.

### Trade-offs
Denormalization simplifies the seat query to a plain `SELECT * FROM seats` at the cost of needing disciplined transactional updates. With `SELECT FOR UPDATE` already guaranteeing transactional consistency on writes, the drift risk is contained. The simplicity benefit outweighs the risk at this scale.
