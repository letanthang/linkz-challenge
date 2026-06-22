import { NextRequest, NextResponse } from 'next/server'
import { container } from '@/infrastructure/container'
import { requireAuth } from '@/lib/requireAuth'
import { errorResponse } from '@/lib/apiResponse'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const userId = await requireAuth(request)
    const { reservationId } = await params
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? undefined
    const result = await container.processPaymentUsecase.execute(
      Number(reservationId),
      userId,
      idempotencyKey
    )
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
