import { CreateReservationUsecase } from '@/modules/reservation/usecase/createReservationUsecase'
import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { SeatRepository } from '@/modules/seat/repository/seatRepository'
import { TransactionManager } from '@/domain/repository/transactionManager'
import { Reservation } from '@/modules/reservation/entity/reservation'
import { Seat } from '@/modules/seat/entity/seat'
import { AppError, ConflictError } from '@/lib/errors'

const availableSeat: Seat = { id: 2, name: 'Seat B', status: 'AVAILABLE', createdAt: new Date() }
const reservedSeat: Seat = { id: 2, name: 'Seat B', status: 'RESERVED', createdAt: new Date() }

const makeReservation = (overrides?: Partial<Reservation>): Reservation => ({
  id: 10,
  userId: 1,
  seatId: 2,
  status: 'PENDING_PAYMENT',
  paymentAttemptCount: 0,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const mockSeatRepo: jest.Mocked<SeatRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByIdForUpdate: jest.fn(),
  updateStatus: jest.fn(),
}

const mockReservationRepo: jest.Mocked<ReservationRepository> = {
  findById: jest.fn(),
  findPendingByUserId: jest.fn(),
  findExpired: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  incrementAttemptCount: jest.fn(),
}

const mockTxManager: TransactionManager = {
  run: jest.fn(async (fn) => fn()),
}

describe('CreateReservationUsecase', () => {
  let usecase: CreateReservationUsecase

  beforeEach(() => {
    jest.clearAllMocks()
    usecase = new CreateReservationUsecase(mockReservationRepo, mockSeatRepo, mockTxManager)
    mockReservationRepo.findPendingByUserId.mockResolvedValue(null)
    mockSeatRepo.findByIdForUpdate.mockResolvedValue(availableSeat)
    mockSeatRepo.updateStatus.mockResolvedValue(undefined)
    mockReservationRepo.create.mockResolvedValue(makeReservation())
  })

  it('creates a reservation with PENDING_PAYMENT status', async () => {
    const result = await usecase.execute(1, 2)
    expect(result.status).toBe('PENDING_PAYMENT')
    expect(result.userId).toBe(1)
    expect(result.seatId).toBe(2)
  })

  it('sets expires_at to 10 minutes from now', async () => {
    const before = Date.now()
    await usecase.execute(1, 2)
    const [createCall] = mockReservationRepo.create.mock.calls
    const expiresAt: Date = createCall[0].expiresAt
    const diff = expiresAt.getTime() - before
    expect(diff).toBeGreaterThanOrEqual(10 * 60 * 1000 - 100)
    expect(diff).toBeLessThanOrEqual(10 * 60 * 1000 + 100)
  })

  it('uses findByIdForUpdate (SELECT FOR UPDATE), not findById', async () => {
    await usecase.execute(1, 2)
    expect(mockSeatRepo.findByIdForUpdate).toHaveBeenCalledWith(2)
    expect(mockSeatRepo.findById).not.toHaveBeenCalled()
  })

  it('updates seat status to RESERVED', async () => {
    await usecase.execute(1, 2)
    expect(mockSeatRepo.updateStatus).toHaveBeenCalledWith(2, 'RESERVED')
  })

  it('throws ConflictError when seat is RESERVED', async () => {
    mockSeatRepo.findByIdForUpdate.mockResolvedValue(reservedSeat)
    await expect(usecase.execute(1, 2)).rejects.toThrow(ConflictError)
  })

  it('throws AppError when user already has a PENDING_PAYMENT reservation', async () => {
    mockReservationRepo.findPendingByUserId.mockResolvedValue(makeReservation())
    await expect(usecase.execute(1, 3)).rejects.toThrow(AppError)
  })
})
