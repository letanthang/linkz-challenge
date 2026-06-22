import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  await prisma.seat.createMany({
    data: [{ name: 'Seat A' }, { name: 'Seat B' }, { name: 'Seat C' }],
    skipDuplicates: true,
  })

  const users = [
    { email: 'alice@test.com', password: 'password123' },
    { email: 'bob@test.com', password: 'password123' },
    { email: 'carol@test.com', password: 'password123' },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash },
    })
  }

  console.log('Seed complete: 3 seats, 3 users')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
