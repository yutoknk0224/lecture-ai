import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const course = await prisma.course.findFirst({
    where: { id, userId: session.user.id },
    include: {
      materials: {
        select: { id: true, title: true, fileType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!course) return Response.json({ error: '見つかりません' }, { status: 404 })
  return Response.json(course)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const course = await prisma.course.findFirst({ where: { id, userId: session.user.id } })
  if (!course) return Response.json({ error: '見つかりません' }, { status: 404 })

  await prisma.course.delete({ where: { id } })
  return Response.json({ success: true })
}
