import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { chatWithMaterial } from '@/app/lib/claude'
import { auth } from '@/app/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { question } = body

  if (!question) {
    return Response.json({ error: '質問を入力してください' }, { status: 400 })
  }

  const material = await prisma.material.findUnique({
    where: { id },
    include: { chatMessages: { orderBy: { createdAt: 'asc' }, take: 20 } },
  })

  if (!material) {
    return Response.json({ error: '資料が見つかりません' }, { status: 404 })
  }

  const history = material.chatMessages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))

  const answer = await chatWithMaterial(
    material.extractedText || material.summary || '',
    question,
    history
  )

  await prisma.chatMessage.createMany({
    data: [
      { materialId: id, role: 'user', content: question },
      { materialId: id, role: 'assistant', content: answer },
    ],
  })

  return Response.json({ answer })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.chatMessage.deleteMany({ where: { materialId: id } })
  return Response.json({ success: true })
}
