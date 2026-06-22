import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/jwt'
import { UnauthorizedError } from '@/lib/errors'

export async function requireAuth(request: NextRequest): Promise<number> {
  const token = request.cookies.get('token')?.value
  if (!token) throw new UnauthorizedError()
  try {
    return await verifyToken(token)
  } catch {
    throw new UnauthorizedError()
  }
}
