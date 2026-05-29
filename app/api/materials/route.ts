import { NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { extractTextFromFile } from '@/app/lib/extractText'
import { summarizeContent } from '@/app/lib/claude'
import { uploadFile } from '@/app/lib/cloudinary'
import { auth } from '@/app/auth'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '認証が必要です' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const courseId = formData.get('courseId') as string
  const title = formData.get('title') as string
  const lectureId = formData.get('lectureId') as string | null

  if (!file || !courseId) {
    return Response.json({ error: 'ファイルと科目IDは必須です' }, { status: 400 })
  }

  // Verify course ownership
  const course = await prisma.course.findFirst({
    where: { id: courseId, userId: session.user.id },
  })
  if (!course) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Write to temp file for text extraction
  const ext = path.extname(file.name)
  const tempPath = path.join(os.tmpdir(), `${uuidv4()}${ext}`)
  fs.writeFileSync(tempPath, buffer)

  let extractedText = ''
  try {
    extractedText = await extractTextFromFile(tempPath, file.type)
  } catch (e) {
    console.error('Text extraction failed:', e)
  } finally {
    try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
  }

  // Upload to Cloudinary
  let filePath = ''
  try {
    filePath = await uploadFile(buffer, file.name, file.type)
  } catch (e) {
    console.error('Cloudinary upload failed:', e)
    return Response.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 })
  }

  let summary = ''
  if (extractedText) {
    try {
      summary = await summarizeContent(extractedText)
    } catch (e) {
      console.error('Summarization failed:', e)
    }
  }

  const material = await prisma.material.create({
    data: {
      title: title || file.name,
      fileName: file.name,
      filePath,
      fileType: file.type,
      fileSize: file.size,
      extractedText,
      summary,
      courseId,
      lectureId: lectureId || null,
    },
  })

  return Response.json(material, { status: 201 })
}
