import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { SeatRepository } from '@/modules/seat/repository/seatRepository'
import { TransactionManager } from '@/domain/repository/transactionManager'
import { Reservation } from '@/modules/reservation/entity/reservation'
import { AppError, ConflictError } from '@/lib/errors'

export class CreateReservationUsecase {
  constructor(
    private reservationRepo: ReservationRepository,
    private seatRepo: SeatRepository,
    private txManager: TransactionManager
  ) {}

  async execute(userId: number, seatId: number): Promise<Reservation> {
    const pending = await this.reservationRepo.findPendingByUserId(userId)
    if (pending) throw new AppError('You already have a pending reservation', 400)

    return this.txManager.run(async () => {
      const seat = await this.seatRepo.findByIdForUpdate(seatId)
      if (!seat) throw new AppError('Seat not found', 404)
      if (seat.status !== 'AVAILABLE') throw new ConflictError('Seat is not available')

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      const reservation = await this.reservationRepo.create({ userId, seatId, expiresAt })
      await this.seatRepo.updateStatus(seatId, 'RESERVED')
      return reservation
    })
  }
}
