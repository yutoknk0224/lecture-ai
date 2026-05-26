import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  const reports = await prisma.expenseReport.findMany({
    include: { items: true, equipmentItems: true, attachments: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, period, dueDate, folderId, reportType } = body
  if (!title || !period) {
    return NextResponse.json({ error: 'title と period は必須です' }, { status: 400 })
  }
  const report = await prisma.expenseReport.create({
    data: {
      title,
      period,
      dueDate: dueDate ?? null,
      folderId: folderId ?? null,
      reportType: reportType ?? 'travel',
    },
    include: { items: true, equipmentItems: true },
  })
  return NextResponse.json(report, { status: 201 })
}
