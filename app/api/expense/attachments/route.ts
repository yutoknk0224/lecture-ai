import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const reportId = formData.get('reportId') as string

  if (!file || !reportId) {
    return NextResponse.json({ error: 'file と reportId は必須です' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'expense')
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

  const ext = path.extname(file.name)
  const savedName = `${uuidv4()}${ext}`
  const filePath = path.join(uploadDir, savedName)
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()))

  const attachment = await prisma.expenseAttachment.create({
    data: {
      reportId,
      fileName: file.name,
      filePath: `/uploads/expense/${savedName}`,
      fileType: file.type,
      fileSize: file.size,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
