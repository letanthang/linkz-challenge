import { NextRequest, NextResponse } from 'next/server'
import { container } from '@/infrastructure/container'
import { requireAuth } from '@/lib/requireAuth'
import { errorResponse } from '@/lib/apiResponse'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const seats = await container.listSeatsUsecase.execute()
    return NextResponse.json({ seats })
  } catch (err) {
    return errorResponse(err)
  }
}
