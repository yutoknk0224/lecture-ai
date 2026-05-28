import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const month = request.nextUrl.searchParams.get('month') // YYYY-MM
  const where = month
    ? { userId: session.user.id, date: { startsWith: month } }
    : { userId: session.user.id }

  const memos = await prisma.lectureMemo.findMany({ where, orderBy: { date: 'asc' } })
  return Response.json(memos)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const { date, content } = await request.json()
  if (!date) return Response.json({ error: 'dateは必須です' }, { status: 400 })

  const existing = await prisma.lectureMemo.findFirst({ where: { userId: session.user.id, date } })
  if (existing) {
    if (!content) {
      await prisma.lectureMemo.delete({ where: { id: existing.id } })
      return Response.json({ deleted: true })
    }
    const updated = await prisma.lectureMemo.update({ where: { id: existing.id }, data: { content } })
    return Response.json(updated)
  }

  if (!content) return Response.json({ deleted: true })
  const memo = await prisma.lectureMemo.create({ data: { userId: session.user.id, date, content } })
  return Response.json(memo, { status: 201 })
}
