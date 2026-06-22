import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret')

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('90d')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<number> {
  const { payload } = await jwtVerify(token, getSecret())
  return Number(payload.sub)
}
