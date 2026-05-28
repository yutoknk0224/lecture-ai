import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const tasks = await prisma.lectureTask.findMany({
    where: { userId: session.user.id },
    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
  })
  return Response.json(tasks)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const { title, dueDate } = await request.json()
  if (!title?.trim()) return Response.json({ error: 'titleは必須です' }, { status: 400 })

  const task = await prisma.lectureTask.create({
    data: { userId: session.user.id, title: title.trim(), dueDate: dueDate || null },
  })
  return Response.json(task, { status: 201 })
}
