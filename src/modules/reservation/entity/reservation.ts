export type ReservationStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED'

export interface Reservation {
  id: number
  userId: number
  seatId: number
  status: ReservationStatus
  paymentAttemptCount: number
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
