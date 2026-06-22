export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface Payment {
  id: number
  reservationId: number
  idempotencyKey: string
  attemptNumber: number
  status: PaymentStatus
  createdAt: Date
}
