import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, color } = await req.json()
  const folder = await prisma.expenseFolder.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
    },
  })
  return NextResponse.json(folder)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.expenseReport.updateMany({
    where: { folderId: id },
    data: { folderId: null },
  })
  await prisma.expenseFolder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
