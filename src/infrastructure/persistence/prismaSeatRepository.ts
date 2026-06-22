import { PrismaClient } from '@prisma/client'
import { SeatRepository } from '@/modules/seat/repository/seatRepository'
import { Seat, SeatStatus } from '@/modules/seat/entity/seat'
import { txStorage } from '@/infrastructure/txStorage'

export class PrismaSeatRepository implements SeatRepository {
  constructor(private prisma: PrismaClient) {}

  private get client() {
    return txStorage.getStore() ?? this.prisma
  }

  async findAll(): Promise<Seat[]> {
    return this.client.seat.findMany({ orderBy: { name: 'asc' } }) as Promise<Seat[]>
  }

  async findById(id: number): Promise<Seat | null> {
    return this.client.seat.findUnique({ where: { id } }) as Promise<Seat | null>
  }

  async findByIdForUpdate(id: number): Promise<Seat | null> {
    const rows = await this.client.$queryRaw<Seat[]>`SELECT id, name, status, created_at as createdAt FROM seats WHERE id = ${id} FOR UPDATE`
    return rows[0] ?? null
  }

  async updateStatus(id: number, status: SeatStatus): Promise<void> {
    await this.client.seat.update({ where: { id }, data: { status } })
  }
}
