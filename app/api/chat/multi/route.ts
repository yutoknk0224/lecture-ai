import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { chatWithMaterial } from '@/app/lib/claude'
import { auth } from '@/app/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { materialIds, question, history = [] } = body

  if (!Array.isArray(materialIds) || materialIds.length === 0) {
    return Response.json({ error: '資料を選択してください' }, { status: 400 })
  }

  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { title: true, extractedText: true },
  })

  const combinedText = materials
    .filter((m) => m.extractedText)
    .map((m, i) => `【資料${i + 1}：${m.title}】\n${m.extractedText}`)
    .join('\n\n---\n\n')

  if (!combinedText) {
    return Response.json({ error: '選択した資料にテキストが見つかりません' }, { status: 404 })
  }

  try {
    const answer = await chatWithMaterial(combinedText, question, history)
    return Response.json({ answer })
  } catch (e) {
    console.error('Multi chat failed:', e)
    return Response.json({ error: 'AI応答に失敗しました' }, { status: 500 })
  }
}
