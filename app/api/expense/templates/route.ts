import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function GET() {
  const templates = await prisma.excelTemplate.findMany({
    include: { mappings: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string
    const description = (formData.get('description') as string) ?? ''
    const sheetName = (formData.get('sheetName') as string) ?? ''

    if (!name) return NextResponse.json({ error: 'nameは必須です' }, { status: 400 })

    let fileName = ''
    let filePath = ''

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = path.extname(file.name)
      fileName = `${Date.now()}${ext}`
      const savePath = path.join(process.cwd(), 'public', 'uploads', 'templates', fileName)
      await writeFile(savePath, buffer)
      filePath = `/uploads/templates/${fileName}`
    }

    const template = await prisma.excelTemplate.create({
      data: { name, description, fileName, filePath, sheetName },
      include: { mappings: true },
    })
    return NextResponse.json(template, { status: 201 })
  } catch (e) {
    console.error('[templates POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
