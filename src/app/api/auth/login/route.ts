import { NextRequest, NextResponse } from 'next/server'
import { container } from '@/infrastructure/container'
import { errorResponse } from '@/lib/apiResponse'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }
    const token = await container.loginUsecase.execute(email, password)
    const response = NextResponse.json({ user: { email } })
    response.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    })
    return response
  } catch (err) {
    return errorResponse(err)
  }
}
