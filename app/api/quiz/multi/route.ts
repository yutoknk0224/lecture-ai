import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { generateQuizzesByFormat } from '@/app/lib/claude'
import { auth } from '@/app/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { materialIds, count = 5, format = 'multiple-choice', difficulty = 'normal' } = body

  if (!Array.isArray(materialIds) || materialIds.length === 0) {
    return Response.json({ error: '資料を選択してください' }, { status: 400 })
  }

  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { title: true, extractedText: true },
  })

  const validMaterials = materials.filter((m) => m.extractedText)

  if (validMaterials.length === 0) {
    return Response.json({ error: '選択した資料にテキストが見つかりません' }, { status: 404 })
  }

  // 資料ごとに問題数を均等に割り振る（AI任せにせず確実に分配）
  const base = Math.floor(count / validMaterials.length)
  const remainder = count % validMaterials.length
  const countPerMaterial = validMaterials.map((_, i) => base + (i < remainder ? 1 : 0))

  // 各資料から個別に問題生成
  const allQuestions: unknown[] = []
  for (let i = 0; i < validMaterials.length; i++) {
    const m = validMaterials[i]
    const n = countPerMaterial[i]
    if (n === 0) continue

    const materialText = `【資料：${m.title}】\n${m.extractedText}`
    try {
      let json = await generateQuizzesByFormat(materialText, n, format, 1, difficulty)
      if (/[Ѐ-ӿ؀-ۿऀ-ॿ]/.test(json)) {
        json = await generateQuizzesByFormat(materialText, n, format, 1, difficulty)
      }
      const parsed = JSON.parse(json.trim())
      if (Array.isArray(parsed)) allQuestions.push(...parsed)
    } catch (e) {
      console.error(`Quiz generation failed for material "${m.title}":`, e)
    }
  }

  if (allQuestions.length === 0) {
    return Response.json({ error: 'AI問題生成に失敗しました' }, { status: 500 })
  }

  return Response.json({ questions: JSON.stringify(allQuestions), format })
}
