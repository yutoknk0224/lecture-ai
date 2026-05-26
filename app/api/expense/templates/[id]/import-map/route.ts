import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

type CellMapEntry = {
  field_name: string
  address: string
  sheet?: string
  data_type?: string
  label?: string
}

// Pythonのcell_map_fields.jsonをTemplateCellMappingとしてインポート
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const template = await prisma.excelTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const entries: CellMapEntry[] = await req.json()
  if (!Array.isArray(entries)) return NextResponse.json({ error: 'Invalid format' }, { status: 400 })

  const valid = entries.filter((e) => e.field_name && e.address)

  await prisma.templateCellMapping.deleteMany({ where: { templateId: id } })
  await prisma.templateCellMapping.createMany({
    data: valid.map((e) => ({
      templateId:  id,
      fieldKey:    e.field_name,
      cellAddress: e.address,
    })),
  })

  return NextResponse.json({ imported: valid.length })
}
