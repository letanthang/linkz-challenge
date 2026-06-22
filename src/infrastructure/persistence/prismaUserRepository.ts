import { PrismaClient } from '@prisma/client'
import { UserRepository } from '@/modules/auth/repository/userRepository'
import { User } from '@/modules/auth/entity/user'

export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } })
  }
}
