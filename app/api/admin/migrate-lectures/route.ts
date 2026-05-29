import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

// 一回限りの移行エンドポイント：既存資料を「未分類」授業回に割り当てる
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: '認証が必要です' }, { status: 401 })

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    include: { materials: { where: { lectureId: null } } },
  })

  let migrated = 0
  for (const course of courses) {
    if (course.materials.length === 0) continue

    const unclassified = await prisma.lecture.create({
      data: { courseId: course.id, title: '未分類', order: 0 },
    })

    await prisma.material.updateMany({
      where: { courseId: course.id, lectureId: null },
      data: { lectureId: unclassified.id },
    })
    migrated += course.materials.length
  }

  return Response.json({ migrated, courses: courses.length })
}
