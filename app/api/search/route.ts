import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export type SearchResult =
  | { type: 'material'; id: string; title: string; courseId: string; courseName: string; lectureId: string | null; lectureTitle: string | null }
  | { type: 'lecture'; id: string; title: string; notes: string | null; courseId: string; courseName: string }
  | { type: 'course'; id: string; name: string }

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return Response.json([])
  }

  const userId = session.user.id

  const [courses, lectures, materials] = await Promise.all([
    prisma.course.findMany({
      where: {
        userId,
        name: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: 5,
    }),
    prisma.lecture.findMany({
      where: {
        course: { userId },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, notes: true, courseId: true, course: { select: { name: true } } },
      take: 5,
    }),
    prisma.material.findMany({
      where: {
        course: { userId },
        title: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true,
        title: true,
        courseId: true,
        lectureId: true,
        course: { select: { name: true } },
        lecture: { select: { title: true } },
      },
      take: 8,
    }),
  ])

  const results: SearchResult[] = [
    ...courses.map((c) => ({ type: 'course' as const, id: c.id, name: c.name })),
    ...lectures.map((l) => ({
      type: 'lecture' as const,
      id: l.id,
      title: l.title,
      notes: l.notes,
      courseId: l.courseId,
      courseName: l.course.name,
    })),
    ...materials.map((m) => ({
      type: 'material' as const,
      id: m.id,
      title: m.title,
      courseId: m.courseId,
      courseName: m.course.name,
      lectureId: m.lectureId,
      lectureTitle: m.lecture?.title ?? null,
    })),
  ]

  return Response.json(results)
}
