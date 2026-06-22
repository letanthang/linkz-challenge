import { PrismaClient } from '@prisma/client'
import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { Reservation, ReservationStatus } from '@/modules/reservation/entity/reservation'
import { txStorage } from '@/infrastructure/txStorage'

export class PrismaReservationRepository implements ReservationRepository {
  constructor(private prisma: PrismaClient) {}

  private get client() {
    return txStorage.getStore() ?? this.prisma
  }

  async findById(id: number): Promise<Reservation | null> {
    return this.client.reservation.findUnique({ where: { id } }) as Promise<Reservation | null>
  }

  async findPendingByUserId(userId: number): Promise<Reservation | null> {
    return this.client.reservation.findFirst({
      where: { userId, status: 'PENDING_PAYMENT' },
    }) as Promise<Reservation | null>
  }

  async findExpired(): Promise<Reservation[]> {
    return this.client.reservation.findMany({
      where: { status: 'PENDING_PAYMENT', expiresAt: { lt: new Date() } },
    }) as Promise<Reservation[]>
  }

  async create(data: { userId: number; seatId: number; expiresAt: Date }): Promise<Reservation> {
    return this.client.reservation.create({ data }) as Promise<Reservation>
  }

  async updateStatus(id: number, status: ReservationStatus): Promise<Reservation> {
    return this.client.reservation.update({
      where: { id },
      data: { status },
    }) as Promise<Reservation>
  }

  async incrementAttemptCount(id: number): Promise<Reservation> {
    return this.client.reservation.update({
      where: { id },
      data: { paymentAttemptCount: { increment: 1 } },
    }) as Promise<Reservation>
  }
}
