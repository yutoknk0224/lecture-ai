import { PrismaClient } from '../generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

let _prisma: PrismaClient | undefined

function getClient(): PrismaClient {
  if (!_prisma) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    const pool = new Pool({ connectionString: url })
    const adapter = new PrismaPg(pool)
    _prisma = new PrismaClient({ adapter })
  }
  return _prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_: PrismaClient, prop: string | symbol) {
    return getClient()[prop as keyof PrismaClient]
  },
})
