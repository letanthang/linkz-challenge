import { PrismaClient } from '@prisma/client'
import { PaymentRepository } from '@/modules/payment/repository/paymentRepository'
import { Payment, PaymentStatus } from '@/modules/payment/entity/payment'
import { txStorage } from '@/infrastructure/txStorage'

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private prisma: PrismaClient) {}

  private get client() {
    return txStorage.getStore() ?? this.prisma
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    return this.client.payment.findUnique({
      where: { idempotencyKey: key },
    }) as Promise<Payment | null>
  }

  async create(data: {
    reservationId: number
    idempotencyKey: string
    attemptNumber: number
    status: PaymentStatus
  }): Promise<Payment> {
    return this.client.payment.create({ data }) as Promise<Payment>
  }
}
