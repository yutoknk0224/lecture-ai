import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.expenseReport.findUnique({
    where: { id },
    include: {
      items: { orderBy: { date: 'asc' } },
      equipmentItems: { orderBy: { createdAt: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(report)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { title, period, status, dueDate } = body
  const report = await prisma.expenseReport.update({
    where: { id },
    data: { title, period, status, ...(dueDate !== undefined && { dueDate: dueDate ?? null }) },
    include: {
      items: { orderBy: { date: 'asc' } },
      equipmentItems: { orderBy: { createdAt: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  })
  return NextResponse.json(report)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.expenseReport.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
