import { prisma } from '@/infrastructure/db'
import { PrismaUserRepository } from '@/infrastructure/persistence/prismaUserRepository'
import { PrismaSeatRepository } from '@/infrastructure/persistence/prismaSeatRepository'
import { PrismaReservationRepository } from '@/infrastructure/persistence/prismaReservationRepository'
import { PrismaPaymentRepository } from '@/infrastructure/persistence/prismaPaymentRepository'
import { PrismaTransactionManager } from '@/infrastructure/prismaTransactionManager'
import { LoginUsecase } from '@/modules/auth/usecase/loginUsecase'
import { ListSeatsUsecase } from '@/modules/seat/usecase/listSeatsUsecase'
import { CreateReservationUsecase } from '@/modules/reservation/usecase/createReservationUsecase'
import { ExpireReservationsUsecase } from '@/modules/reservation/usecase/expireReservationsUsecase'
import { ProcessPaymentUsecase } from '@/modules/payment/usecase/processPaymentUsecase'

const userRepo = new PrismaUserRepository(prisma)
const seatRepo = new PrismaSeatRepository(prisma)
const reservationRepo = new PrismaReservationRepository(prisma)
const paymentRepo = new PrismaPaymentRepository(prisma)
const txManager = new PrismaTransactionManager(prisma)

export const expireReservationsUsecase = new ExpireReservationsUsecase(reservationRepo, seatRepo)

export const container = {
  loginUsecase: new LoginUsecase(userRepo, process.env.JWT_SECRET ?? 'fallback-secret'),
  listSeatsUsecase: new ListSeatsUsecase(seatRepo, expireReservationsUsecase),
  createReservationUsecase: new CreateReservationUsecase(reservationRepo, seatRepo, txManager),
  processPaymentUsecase: new ProcessPaymentUsecase(paymentRepo, reservationRepo),
}
