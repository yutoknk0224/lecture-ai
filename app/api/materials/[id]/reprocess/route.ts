import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { extractTextFromFile } from '@/app/lib/extractText'
import { summarizeContent } from '@/app/lib/claude'
import { downloadToBuffer } from '@/app/lib/cloudinary'
import { auth } from '@/app/auth'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const material = await prisma.material.findUnique({
    where: { id },
    include: { course: { select: { userId: true } } },
  })
  if (!material) {
    return Response.json({ error: '資料が見つかりません' }, { status: 404 })
  }
  if (material.course.userId !== session.user.id) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  // Download file from Cloudinary to temp path
  const ext = path.extname(new URL(material.filePath).pathname) || ''
  const tempPath = path.join(os.tmpdir(), `${uuidv4()}${ext}`)

  let extractedText = ''
  try {
    const fileBuffer = await downloadToBuffer(material.filePath)
    fs.writeFileSync(tempPath, fileBuffer)
    extractedText = await extractTextFromFile(tempPath, material.fileType)
  } catch (e) {
    console.error('Text extraction failed:', e)
    return Response.json({ error: 'テキスト抽出に失敗しました' }, { status: 500 })
  } finally {
    try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
  }

  let summary = ''
  if (extractedText) {
    try {
      summary = await summarizeContent(extractedText)
    } catch (e) {
      console.error('Summarization failed:', e)
    }
  }

  const updated = await prisma.material.update({
    where: { id },
    data: { extractedText, summary },
  })

  return Response.json(updated)
}
