export type SeatStatus = 'AVAILABLE' | 'RESERVED'

export interface Seat {
  id: number
  name: string
  status: SeatStatus
  createdAt: Date
}
