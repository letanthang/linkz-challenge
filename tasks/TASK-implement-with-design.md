# Task: Implement automotive booking service backend by provided system design

## Context
- Build a small public seat reservation platform i 've just designed system
- Requirement: ./docs/design/seat-reservation/design-requirements.md
- Chosen architecture: ./docs/design/seat-reservation/design-chosen.md
- Services design: ./docs/design/seat-reservation/design-services.md
- Data model: ./docs/design/seat-reservation/design-data-model.md
- Api contract (openAPI spec): ./docs/design/seat-reservation/design-api-contract.yaml
- Architeture decision records:  ./docs/design/seat-reservation/adrs.yaml

## Acceptance Criteria
<!-- These become your tests -->
- [ ] Login with session expiry at 90 days
- [ ] Select a seat
- [ ] Proceed to payment
- [ ] Successfully reserve the seat upon payment completion
- [ ] No Double Booking
- [ ] Idempotency


## Success Verification

```bash
# 1. Type safety
npx tsc --noEmit

# 2. Unit tests — all must pass
npm test

# 3. Build (catches Next.js compilation errors)
npm run build
```

### Unit test coverage required (Jest)

Each usecase must have a corresponding `*.test.ts` file with all repository dependencies mocked via interfaces:

| Test file | Covers acceptance criteria |
|---|---|
| `src/modules/auth/usecase/loginUsecase.test.ts` | Login · 90-day JWT expiry |
| `src/modules/seat/usecase/listSeatsUsecase.test.ts` | Select a seat · lazy expiry triggers correctly |
| `src/modules/reservation/usecase/createReservationUsecase.test.ts` | No double booking · rejects second PENDING_PAYMENT per user |
| `src/modules/reservation/usecase/expireReservationsUsecase.test.ts` | TTL: PENDING_PAYMENT → EXPIRED · seat → AVAILABLE |
| `src/modules/payment/usecase/processPaymentUsecase.test.ts` | Fail on attempt 1 · succeed on retry · idempotency key deduplication · rejects expired reservation |

## Notes
- Architeture decision records:  ./docs/design/seat-reservation/adrs.yaml
<!-- Edge cases, constraints, decisions -->