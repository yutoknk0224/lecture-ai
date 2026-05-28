import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const { id } = await params
  const task = await prisma.lectureTask.findFirst({ where: { id, userId: session.user.id } })
  if (!task) return Response.json({ error: 'タスクが見つかりません' }, { status: 404 })

  const body = await request.json()
  const updated = await prisma.lectureTask.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
      ...(body.completed !== undefined && { completed: body.completed }),
    },
  })
  return Response.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const { id } = await params
  const task = await prisma.lectureTask.findFirst({ where: { id, userId: session.user.id } })
  if (!task) return Response.json({ error: 'タスクが見つかりません' }, { status: 404 })

  await prisma.lectureTask.delete({ where: { id } })
  return Response.json({ deleted: true })
}
