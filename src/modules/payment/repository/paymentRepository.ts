import { Payment, PaymentStatus } from '@/modules/payment/entity/payment'

export interface PaymentRepository {
  findByIdempotencyKey(key: string): Promise<Payment | null>
  create(data: {
    reservationId: number
    idempotencyKey: string
    attemptNumber: number
    status: PaymentStatus
  }): Promise<Payment>
}
