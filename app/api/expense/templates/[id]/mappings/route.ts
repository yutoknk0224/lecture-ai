import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mappings = await prisma.templateCellMapping.findMany({ where: { templateId: id } })
  return NextResponse.json(mappings)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { mappings } = await req.json() as { mappings: { fieldKey: string; cellAddress: string }[] }

  await prisma.templateCellMapping.deleteMany({ where: { templateId: id } })

  if (mappings && mappings.length > 0) {
    await prisma.templateCellMapping.createMany({
      data: mappings
        .filter((m) => m.cellAddress.trim() !== '')
        .map((m) => ({ templateId: id, fieldKey: m.fieldKey, cellAddress: m.cellAddress.trim() })),
    })
  }

  const updated = await prisma.templateCellMapping.findMany({ where: { templateId: id } })
  return NextResponse.json(updated)
}
