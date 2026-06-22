import { Seat, SeatStatus } from '@/modules/seat/entity/seat'

export interface SeatRepository {
  findAll(): Promise<Seat[]>
  findById(id: number): Promise<Seat | null>
  findByIdForUpdate(id: number): Promise<Seat | null>
  updateStatus(id: number, status: SeatStatus): Promise<void>
}
