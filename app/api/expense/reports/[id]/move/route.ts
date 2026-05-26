import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action, targetFolderId } = await req.json() as { action: 'move' | 'copy'; targetFolderId: string | null }

  if (action === 'move') {
    const report = await prisma.expenseReport.update({
      where: { id },
      data: { folderId: targetFolderId ?? null },
    })
    return NextResponse.json(report)
  }

  if (action === 'copy') {
    const source = await prisma.expenseReport.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const copy = await prisma.expenseReport.create({
      data: {
        title: `${source.title}（コピー）`,
        period: source.period,
        status: 'draft',
        dueDate: source.dueDate,
        folderId: targetFolderId ?? null,
        items: {
          create: source.items.map(item => ({
            date: item.date,
            purpose: item.purpose,
            destination: item.destination,
            departure: item.departure,
            transport: item.transport,
            amount: item.amount,
            category: item.category,
            notes: item.notes,
            sourceEmail: item.sourceEmail,
          })),
        },
      },
      include: { items: true },
    })
    return NextResponse.json(copy, { status: 201 })
  }

  return NextResponse.json({ error: 'action must be move or copy' }, { status: 400 })
}
