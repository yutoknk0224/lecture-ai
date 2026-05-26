import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { generateQuizzesByFormat } from '@/app/lib/claude'
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
  const count = body.count || 5
  const format = body.format || 'multiple-choice'
  const difficulty = body.difficulty || 'normal'

  const material = await prisma.material.findUnique({ where: { id } })
  if (!material || !material.extractedText) {
    return Response.json({ error: '資料のテキストが見つかりません' }, { status: 404 })
  }

  const materialText = `【資料：${material.title}】\n${material.extractedText}`

  let questionsJson: string
  try {
    questionsJson = await generateQuizzesByFormat(materialText, count, format, 1, difficulty)
  } catch (e) {
    console.error('Quiz generation failed:', e)
    return Response.json({ error: 'AI問題生成に失敗しました' }, { status: 500 })
  }

  // キリル文字・アラビア文字など明らかな非日本語が混入していたら再生成（1回のみ）
  const hasForeignScript = /[Ѐ-ӿ؀-ۿऀ-ॿ]/.test(questionsJson)
  if (hasForeignScript) {
    console.warn('Foreign script detected in quiz output, retrying...')
    try {
      questionsJson = await generateQuizzesByFormat(materialText, count, format, 1, difficulty)
    } catch (e) {
      console.error('Quiz regeneration failed:', e)
      return Response.json({ error: 'AI問題生成に失敗しました' }, { status: 500 })
    }
  }

  const quiz = await prisma.quiz.create({
    data: {
      materialId: id,
      questions: questionsJson,
      format,
    },
  })

  return Response.json(quiz, { status: 201 })
}
