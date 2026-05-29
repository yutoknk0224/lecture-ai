import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

async function getOwnedLecture(id: string, userId: string) {
  return prisma.lecture.findFirst({
    where: { id, course: { userId } },
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const { id } = await params
  const lecture = await getOwnedLecture(id, session.user.id)
  if (!lecture) return Response.json({ error: '見つかりません' }, { status: 404 })

  const body = await request.json()
  const updated = await prisma.lecture.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.date !== undefined && { date: body.date || null }),
      ...(body.instructor !== undefined && { instructor: body.instructor || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
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
  const lecture = await getOwnedLecture(id, session.user.id)
  if (!lecture) return Response.json({ error: '見つかりません' }, { status: 404 })

  // 未分類授業回に資料を移動してから削除
  const unclassified = await prisma.lecture.findFirst({
    where: { courseId: lecture.courseId, title: '未分類' },
  })
  if (unclassified && unclassified.id !== id) {
    await prisma.material.updateMany({
      where: { lectureId: id },
      data: { lectureId: unclassified.id },
    })
  }

  await prisma.lecture.delete({ where: { id } })
  return Response.json({ deleted: true })
}
