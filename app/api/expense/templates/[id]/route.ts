import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await prisma.excelTemplate.findUnique({
    where: { id },
    include: { mappings: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, description, sheetName } = await req.json()
  const template = await prisma.excelTemplate.update({
    where: { id },
    data: { name, description, sheetName },
    include: { mappings: true },
  })
  return NextResponse.json(template)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await prisma.excelTemplate.findUnique({ where: { id } })
  if (template?.filePath) {
    const absPath = path.join(process.cwd(), 'public', template.filePath)
    await unlink(absPath).catch(() => null)
  }
  await prisma.excelTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
