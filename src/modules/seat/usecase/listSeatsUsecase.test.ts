import { ListSeatsUsecase } from '@/modules/seat/usecase/listSeatsUsecase'
import { SeatRepository } from '@/modules/seat/repository/seatRepository'
import { ExpireReservationsUsecase } from '@/modules/reservation/usecase/expireReservationsUsecase'
import { Seat } from '@/modules/seat/entity/seat'

const seats: Seat[] = [
  { id: 1, name: 'Seat A', status: 'AVAILABLE', createdAt: new Date() },
  { id: 2, name: 'Seat B', status: 'RESERVED', createdAt: new Date() },
  { id: 3, name: 'Seat C', status: 'AVAILABLE', createdAt: new Date() },
]

const mockSeatRepo: jest.Mocked<SeatRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByIdForUpdate: jest.fn(),
  updateStatus: jest.fn(),
}

const mockExpireUsecase = { execute: jest.fn() } as unknown as ExpireReservationsUsecase

describe('ListSeatsUsecase', () => {
  let usecase: ListSeatsUsecase

  beforeEach(() => {
    jest.clearAllMocks()
    usecase = new ListSeatsUsecase(mockSeatRepo, mockExpireUsecase)
    mockSeatRepo.findAll.mockResolvedValue(seats)
    mockExpireUsecase.execute = jest.fn().mockResolvedValue(undefined)
  })

  it('returns all seats', async () => {
    const result = await usecase.execute()
    expect(result).toEqual(seats)
  })

  it('calls expireReservationsUsecase before fetching seats', async () => {
    const callOrder: string[] = []
    mockExpireUsecase.execute = jest.fn().mockImplementation(async () => {
      callOrder.push('expire')
    })
    mockSeatRepo.findAll.mockImplementation(async () => {
      callOrder.push('findAll')
      return seats
    })

    await usecase.execute()

    expect(callOrder).toEqual(['expire', 'findAll'])
  })

  it('returns post-expiry seat statuses', async () => {
    const updatedSeats: Seat[] = seats.map((s) =>
      s.id === 2 ? { ...s, status: 'AVAILABLE' } : s
    )
    mockExpireUsecase.execute = jest.fn().mockResolvedValue(undefined)
    mockSeatRepo.findAll.mockResolvedValue(updatedSeats)

    const result = await usecase.execute()

    expect(result.find((s) => s.id === 2)?.status).toBe('AVAILABLE')
  })
})
