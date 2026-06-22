import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { UserRepository } from '@/modules/auth/repository/userRepository'
import { UnauthorizedError } from '@/lib/errors'

export class LoginUsecase {
  constructor(
    private userRepo: UserRepository,
    private jwtSecret: string
  ) {}

  async execute(email: string, password: string): Promise<string> {
    const user = await this.userRepo.findByEmail(email)
    if (!user) throw new UnauthorizedError('Invalid email or password')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedError('Invalid email or password')

    const secret = new TextEncoder().encode(this.jwtSecret)
    return new SignJWT({ sub: String(user.id) })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('90d')
      .sign(secret)
  }
}
