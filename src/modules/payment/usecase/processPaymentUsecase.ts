import { PaymentRepository } from '@/modules/payment/repository/paymentRepository'
import { ReservationRepository } from '@/modules/reservation/repository/reservationRepository'
import { Payment } from '@/modules/payment/entity/payment'
import { Reservation } from '@/modules/reservation/entity/reservation'
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors'

export class ProcessPaymentUsecase {
  constructor(
    private paymentRepo: PaymentRepository,
    private reservationRepo: ReservationRepository
  ) {}

  async execute(
    reservationId: number,
    userId: number,
    idempotencyKey?: string
  ): Promise<{ payment: Payment; reservation: Reservation }> {
    const reservation = await this.reservationRepo.findById(reservationId)
    if (!reservation) throw new NotFoundError('Reservation not found')
    if (reservation.userId !== userId) throw new ForbiddenError()
    if (reservation.status === 'EXPIRED') throw new AppError('Reservation has expired', 400)
    if (reservation.status === 'CONFIRMED') throw new AppError('Reservation is already confirmed', 400)
    if (new Date() > reservation.expiresAt) throw new AppError('Reservation has expired', 400)

    if (idempotencyKey) {
      const cached = await this.paymentRepo.findByIdempotencyKey(idempotencyKey)
      if (cached) return { payment: cached, reservation }
    }

    const key = idempotencyKey ?? crypto.randomUUID()
    const updated = await this.reservationRepo.incrementAttemptCount(reservationId)
    const attemptNumber = updated.paymentAttemptCount

    if (attemptNumber === 1) {
      const payment = await this.paymentRepo.create({
        reservationId,
        idempotencyKey: key,
        attemptNumber,
        status: 'FAILED',
      })
      return { payment, reservation: updated }
    }

    const payment = await this.paymentRepo.create({
      reservationId,
      idempotencyKey: key,
      attemptNumber,
      status: 'SUCCESS',
    })
    const confirmed = await this.reservationRepo.updateStatus(reservationId, 'CONFIRMED')
    return { payment, reservation: confirmed }
  }
}
