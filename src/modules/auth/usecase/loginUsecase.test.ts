import { jwtVerify } from 'jose'
import { LoginUsecase } from '@/modules/auth/usecase/loginUsecase'
import { UserRepository } from '@/modules/auth/repository/userRepository'
import { User } from '@/modules/auth/entity/user'
import { UnauthorizedError } from '@/lib/errors'

jest.mock('bcryptjs', () => ({ compare: jest.fn() }))
import bcrypt from 'bcryptjs'

const TEST_SECRET = 'test-secret'

const mockUser: User = {
  id: 1,
  email: 'alice@test.com',
  passwordHash: '$2b$10$hashedpassword',
  createdAt: new Date(),
}

const mockUserRepo: jest.Mocked<UserRepository> = {
  findByEmail: jest.fn(),
}

describe('LoginUsecase', () => {
  let usecase: LoginUsecase

  beforeEach(() => {
    jest.clearAllMocks()
    usecase = new LoginUsecase(mockUserRepo, TEST_SECRET)
  })

  it('returns a signed JWT for valid credentials', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const token = await usecase.execute('alice@test.com', 'password123')

    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3)
  })

  it('JWT payload contains sub equal to userId', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const token = await usecase.execute('alice@test.com', 'password123')
    const secret = new TextEncoder().encode(TEST_SECRET)
    const { payload } = await jwtVerify(token, secret)

    expect(payload.sub).toBe(String(mockUser.id))
  })

  it('JWT expiry is approximately 90 days from now', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const before = Math.floor(Date.now() / 1000)
    const token = await usecase.execute('alice@test.com', 'password123')
    const secret = new TextEncoder().encode(TEST_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const ninetyDays = 90 * 24 * 60 * 60
    expect(payload.exp).toBeGreaterThanOrEqual(before + ninetyDays - 5)
    expect(payload.exp).toBeLessThanOrEqual(before + ninetyDays + 5)
  })

  it('throws UnauthorizedError when email is not found', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null)

    await expect(usecase.execute('nobody@test.com', 'password123')).rejects.toThrow(
      UnauthorizedError
    )
  })

  it('throws UnauthorizedError when password is wrong', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    await expect(usecase.execute('alice@test.com', 'wrong')).rejects.toThrow(UnauthorizedError)
  })
})
