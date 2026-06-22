import { NextRequest, NextResponse } from 'next/server'
import { container } from '@/infrastructure/container'
import { requireAuth } from '@/lib/requireAuth'
import { errorResponse } from '@/lib/apiResponse'

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const { seatId } = await request.json()
    if (!seatId) {
      return NextResponse.json({ error: 'seatId is required' }, { status: 400 })
    }
    const reservation = await container.createReservationUsecase.execute(userId, seatId)
    return NextResponse.json({ reservation }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
