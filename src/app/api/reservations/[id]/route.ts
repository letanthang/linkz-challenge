import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/infrastructure/db'
import { requireAuth } from '@/lib/requireAuth'
import { errorResponse } from '@/lib/apiResponse'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth(request)
    const { id } = await params
    const reservation = await prisma.reservation.findUnique({ where: { id: Number(id) } })
    if (!reservation) throw new NotFoundError('Reservation not found')
    if (reservation.userId !== userId) throw new ForbiddenError()
    return NextResponse.json({ reservation })
  } catch (err) {
    return errorResponse(err)
  }
}
