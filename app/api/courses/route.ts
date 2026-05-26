import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    include: {
      materials: {
        select: { id: true, title: true, fileType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(courses)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { name, description, day, period, year, semester } = body

  if (!name) {
    return Response.json({ error: '科目名は必須です' }, { status: 400 })
  }

  const course = await prisma.course.create({
    data: {
      name,
      description,
      day: day ?? null,
      period: period ?? null,
      year: year ?? null,
      semester: semester ?? null,
      userId: session.user.id,
    },
  })
  return Response.json(course, { status: 201 })
}
