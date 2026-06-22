import { ExpireReservationsUsecase } from '@/modules/reservation/usecase/expireReservationsUsecase'
import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { SeatRepository } from '@/modules/seat/repository/seatRepository'
import { Reservation } from '@/modules/reservation/entity/reservation'

const makeExpiredReservation = (id: number, seatId: number): Reservation => ({
  id,
  userId: 1,
  seatId,
  status: 'PENDING_PAYMENT',
  paymentAttemptCount: 0,
  expiresAt: new Date(Date.now() - 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
})

const mockReservationRepo: jest.Mocked<ReservationRepository> = {
  findById: jest.fn(),
  findPendingByUserId: jest.fn(),
  findExpired: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  incrementAttemptCount: jest.fn(),
}

const mockSeatRepo: jest.Mocked<SeatRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByIdForUpdate: jest.fn(),
  updateStatus: jest.fn(),
}

describe('ExpireReservationsUsecase', () => {
  let usecase: ExpireReservationsUsecase

  beforeEach(() => {
    jest.clearAllMocks()
    usecase = new ExpireReservationsUsecase(mockReservationRepo, mockSeatRepo)
    mockReservationRepo.updateStatus.mockImplementation(async (id) => ({
      ...makeExpiredReservation(id, 1),
      status: 'EXPIRED',
    }))
    mockSeatRepo.updateStatus.mockResolvedValue(undefined)
  })

  it('transitions expired reservations to EXPIRED and releases seats', async () => {
    mockReservationRepo.findExpired.mockResolvedValue([
      makeExpiredReservation(1, 1),
      makeExpiredReservation(2, 3),
    ])

    await usecase.execute()

    expect(mockReservationRepo.updateStatus).toHaveBeenCalledWith(1, 'EXPIRED')
    expect(mockReservationRepo.updateStatus).toHaveBeenCalledWith(2, 'EXPIRED')
    expect(mockSeatRepo.updateStatus).toHaveBeenCalledWith(1, 'AVAILABLE')
    expect(mockSeatRepo.updateStatus).toHaveBeenCalledWith(3, 'AVAILABLE')
  })

  it('does not update anything when no reservations are expired', async () => {
    mockReservationRepo.findExpired.mockResolvedValue([])

    await usecase.execute()

    expect(mockReservationRepo.updateStatus).not.toHaveBeenCalled()
    expect(mockSeatRepo.updateStatus).not.toHaveBeenCalled()
  })

  it('handles multiple expired reservations independently', async () => {
    mockReservationRepo.findExpired.mockResolvedValue([
      makeExpiredReservation(5, 2),
    ])

    await usecase.execute()

    expect(mockReservationRepo.updateStatus).toHaveBeenCalledTimes(1)
    expect(mockSeatRepo.updateStatus).toHaveBeenCalledTimes(1)
  })
})
