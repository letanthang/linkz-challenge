import { SeatRepository } from '@/modules/seat/repository/seatRepository'
import { Seat } from '@/modules/seat/entity/seat'
import { ExpireReservationsUsecase } from '@/modules/reservation/usecase/expireReservationsUsecase'

export class ListSeatsUsecase {
  constructor(
    private seatRepo: SeatRepository,
    private expireReservationsUsecase: ExpireReservationsUsecase
  ) {}

  async execute(): Promise<Seat[]> {
    await this.expireReservationsUsecase.execute()
    return this.seatRepo.findAll()
  }
}
