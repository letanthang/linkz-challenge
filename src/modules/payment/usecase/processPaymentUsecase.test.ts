import { ProcessPaymentUsecase } from '@/modules/payment/usecase/processPaymentUsecase'
import { PaymentRepository } from '@/modules/payment/repository/paymentRepository'
import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { Reservation } from '@/modules/reservation/entity/reservation'
import { Payment } from '@/modules/payment/entity/payment'
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors'

const future = new Date(Date.now() + 10 * 60 * 1000)
const past = new Date(Date.now() - 1000)

const makePendingReservation = (overrides?: Partial<Reservation>): Reservation => ({
  id: 42,
  userId: 1,
  seatId: 2,
  status: 'PENDING_PAYMENT',
  paymentAttemptCount: 0,
  expiresAt: future,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makePayment = (overrides?: Partial<Payment>): Payment => ({
  id: 7,
  reservationId: 42,
  idempotencyKey: 'key-abc',
  attemptNumber: 1,
  status: 'FAILED',
  createdAt: new Date(),
  ...overrides,
})

const mockReservationRepo: jest.Mocked<ReservationRepository> = {
  findById: jest.fn(),
  findPendingByUserId: jest.fn(),
  findExpired: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  incrementAttemptCount: jest.fn(),
}

const mockPaymentRepo: jest.Mocked<PaymentRepository> = {
  findByIdempotencyKey: jest.fn(),
  create: jest.fn(),
}

describe('ProcessPaymentUsecase', () => {
  let usecase: ProcessPaymentUsecase

  beforeEach(() => {
    jest.clearAllMocks()
    usecase = new ProcessPaymentUsecase(mockPaymentRepo, mockReservationRepo)
    mockPaymentRepo.findByIdempotencyKey.mockResolvedValue(null)
  })

  describe('first attempt (paymentAttemptCount = 0)', () => {
    it('returns FAILED payment and reservation stays PENDING_PAYMENT', async () => {
      const reservation = makePendingReservation({ paymentAttemptCount: 0 })
      mockReservationRepo.findById.mockResolvedValue(reservation)
      const afterIncrement = { ...reservation, paymentAttemptCount: 1 }
      mockReservationRepo.incrementAttemptCount.mockResolvedValue(afterIncrement)
      const failedPayment = makePayment({ status: 'FAILED', attemptNumber: 1 })
      mockPaymentRepo.create.mockResolvedValue(failedPayment)

      const result = await usecase.execute(42, 1)

      expect(result.payment.status).toBe('FAILED')
      expect(result.reservation.status).toBe('PENDING_PAYMENT')
      expect(mockReservationRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  describe('retry (paymentAttemptCount >= 1)', () => {
    it('returns SUCCESS payment and reservation becomes CONFIRMED', async () => {
      const reservation = makePendingReservation({ paymentAttemptCount: 1 })
      mockReservationRepo.findById.mockResolvedValue(reservation)
      const afterIncrement = { ...reservation, paymentAttemptCount: 2 }
      mockReservationRepo.incrementAttemptCount.mockResolvedValue(afterIncrement)
      const successPayment = makePayment({ status: 'SUCCESS', attemptNumber: 2 })
      mockPaymentRepo.create.mockResolvedValue(successPayment)
      const confirmed = { ...reservation, status: 'CONFIRMED' as const }
      mockReservationRepo.updateStatus.mockResolvedValue(confirmed)

      const result = await usecase.execute(42, 1)

      expect(result.payment.status).toBe('SUCCESS')
      expect(result.reservation.status).toBe('CONFIRMED')
      expect(mockReservationRepo.updateStatus).toHaveBeenCalledWith(42, 'CONFIRMED')
    })
  })

  describe('idempotency', () => {
    it('returns cached payment without incrementing attempt count when key matches', async () => {
      const reservation = makePendingReservation({ paymentAttemptCount: 1 })
      mockReservationRepo.findById.mockResolvedValue(reservation)
      const cachedPayment = makePayment({ idempotencyKey: 'existing-key', status: 'FAILED' })
      mockPaymentRepo.findByIdempotencyKey.mockResolvedValue(cachedPayment)

      const result = await usecase.execute(42, 1, 'existing-key')

      expect(result.payment).toEqual(cachedPayment)
      expect(mockReservationRepo.incrementAttemptCount).not.toHaveBeenCalled()
      expect(mockPaymentRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('error cases', () => {
    it('throws NotFoundError when reservation does not exist', async () => {
      mockReservationRepo.findById.mockResolvedValue(null)
      await expect(usecase.execute(99, 1)).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError when reservation belongs to a different user', async () => {
      mockReservationRepo.findById.mockResolvedValue(makePendingReservation({ userId: 99 }))
      await expect(usecase.execute(42, 1)).rejects.toThrow(ForbiddenError)
    })

    it('throws AppError when reservation is EXPIRED by status', async () => {
      mockReservationRepo.findById.mockResolvedValue(
        makePendingReservation({ status: 'EXPIRED' })
      )
      await expect(usecase.execute(42, 1)).rejects.toThrow(AppError)
    })

    it('throws AppError when reservation is already CONFIRMED', async () => {
      mockReservationRepo.findById.mockResolvedValue(
        makePendingReservation({ status: 'CONFIRMED' })
      )
      await expect(usecase.execute(42, 1)).rejects.toThrow(AppError)
    })

    it('throws AppError when reservation TTL has passed', async () => {
      mockReservationRepo.findById.mockResolvedValue(
        makePendingReservation({ expiresAt: past })
      )
      await expect(usecase.execute(42, 1)).rejects.toThrow(AppError)
    })
  })
})
