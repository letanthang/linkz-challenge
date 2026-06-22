import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { SeatRepository } from '@/modules/seat/repository/seatRepository'

export class ExpireReservationsUsecase {
  constructor(
    private reservationRepo: ReservationRepository,
    private seatRepo: SeatRepository
  ) {}

  async execute(): Promise<void> {
    const expired = await this.reservationRepo.findExpired()
    for (const reservation of expired) {
      await this.reservationRepo.updateStatus(reservation.id, 'EXPIRED')
      await this.seatRepo.updateStatus(reservation.seatId, 'AVAILABLE')
    }
  }
}
