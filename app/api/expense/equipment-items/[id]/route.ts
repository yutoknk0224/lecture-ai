import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const {
    itemName, quantity, unitPrice,
    category, purchaseDate, vendor, receiptNo, modelNumber, purpose, notes, url, quotationNo,
  } = body

  const qty = parseInt(quantity)
  const price = parseInt(unitPrice)
  const amount = qty * price

  const item = await prisma.equipmentItem.update({
    where: { id },
    data: {
      itemName,
      quantity: qty,
      unitPrice: price,
      amount,
      ...(category !== undefined && { category }),
      ...(purchaseDate !== undefined && { purchaseDate }),
      ...(vendor !== undefined && { vendor }),
      ...(receiptNo !== undefined && { receiptNo }),
      ...(modelNumber !== undefined && { modelNumber }),
      ...(purpose !== undefined && { purpose }),
      ...(notes !== undefined && { notes }),
      ...(url !== undefined && { url }),
      ...(quotationNo !== undefined && { quotationNo }),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.equipmentItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
