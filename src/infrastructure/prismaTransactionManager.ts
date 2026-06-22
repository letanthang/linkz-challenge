import { PrismaClient } from '@prisma/client'
import { TransactionManager } from '@/domain/repository/transactionManager'
import { txStorage } from '@/infrastructure/txStorage'

export class PrismaTransactionManager implements TransactionManager {
  constructor(private prisma: PrismaClient) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => txStorage.run(tx, fn))
  }
}
