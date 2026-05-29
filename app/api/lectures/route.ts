import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const { courseId, title, date, instructor, notes } = await request.json()
  if (!courseId || !title?.trim()) return Response.json({ error: 'courseId・titleは必須です' }, { status: 400 })

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: session.user.id } })
  if (!course) return Response.json({ error: '権限がありません' }, { status: 403 })

  const count = await prisma.lecture.count({ where: { courseId } })
  const lecture = await prisma.lecture.create({
    data: { courseId, title: title.trim(), date: date || null, instructor: instructor || null, notes: notes || null, order: count },
  })
  return Response.json(lecture, { status: 201 })
}
