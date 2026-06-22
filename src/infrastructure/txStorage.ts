import { AsyncLocalStorage } from 'async_hooks'
import { Prisma } from '@prisma/client'

type TxClient = Prisma.TransactionClient

export const txStorage = new AsyncLocalStorage<TxClient>()
