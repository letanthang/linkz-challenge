import { Reservation, ReservationStatus } from '@/modules/reservation/entity/reservation'

export interface ReservationRepository {
  findById(id: number): Promise<Reservation | null>
  findPendingByUserId(userId: number): Promise<Reservation | null>
  findExpired(): Promise<Reservation[]>
  create(data: { userId: number; seatId: number; expiresAt: Date }): Promise<Reservation>
  updateStatus(id: number, status: ReservationStatus): Promise<Reservation>
  incrementAttemptCount(id: number): Promise<Reservation>
}
