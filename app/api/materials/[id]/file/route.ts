import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { auth } from '@/app/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id } = await params
  const material = await prisma.material.findUnique({
    where: { id },
    include: { course: { select: { userId: true } } },
  })

  if (!material || material.course.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const res = await fetch(material.filePath)
  if (!res.ok) return new Response('Failed to fetch file', { status: 500 })

  const buffer = await res.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': material.fileType,
      'Content-Disposition': 'inline',
    },
  })
}
