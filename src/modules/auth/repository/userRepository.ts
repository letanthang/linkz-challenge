import { User } from '@/modules/auth/entity/user'

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>
}
