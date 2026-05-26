import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { reportId, date, purpose, destination, departure, transport, amount, category, notes, sourceEmail } = body
  if (!reportId || !date || !purpose || amount === undefined) {
    return NextResponse.json({ error: '必須フィールドが不足しています' }, { status: 400 })
  }
  const item = await prisma.expenseItem.create({
    data: {
      reportId,
      date,
      purpose,
      destination,
      departure: departure ?? '',
      transport: transport ?? '',
      amount: Number(amount),
      category: category ?? '交通費',
      notes: notes ?? '',
      sourceEmail: sourceEmail ?? '',
    },
  })
  return NextResponse.json(item, { status: 201 })
}
