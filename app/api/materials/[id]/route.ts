import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import fs from 'fs'
import path from 'path'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const material = await prisma.material.findUnique({
    where: { id },
    include: { quizzes: true, chatMessages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!material) {
    return Response.json({ error: '資料が見つかりません' }, { status: 404 })
  }
  return Response.json(material)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const material = await prisma.material.findUnique({ where: { id } })
  if (!material) {
    return Response.json({ error: '資料が見つかりません' }, { status: 404 })
  }

  const fullPath = path.join(process.cwd(), 'public', material.filePath)
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }

  await prisma.material.delete({ where: { id } })
  return Response.json({ success: true })
}
