import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { date, purpose, destination, departure, transport, amount, category, notes } = body
  const item = await prisma.expenseItem.update({
    where: { id },
    data: {
      date,
      purpose,
      destination,
      departure: departure ?? '',
      transport: transport ?? '',
      amount: Number(amount),
      category: category ?? '交通費',
      notes: notes ?? '',
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.expenseItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
